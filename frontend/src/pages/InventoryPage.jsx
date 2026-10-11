import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, X, AlertCircle } from 'lucide-react';
import { db, isRetryableError, isQueuedRecord } from '../services/db';
import LowStockBell from '../components/inventory/LowStockBell';
import LoadingSkeleton from '../components/analytics/LoadingSkeleton';
import { saveStockCache, loadStockCache } from '../services/stockCache';
import { processQueue, offlineQueue } from '../services/offlineQueue';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'good', label: 'Good' },
  { key: 'low', label: 'Low Stock' },
  { key: 'out', label: 'Out of Stock' },
];

const statusKeyOf = (stock) => {
  const s = Number(stock);
  if (s <= 0) return 'out';
  if (s < 5) return 'low';
  return 'good';
};

export default function InventoryPage({ userRole }) {
  // Stockists manage stock day-to-day (add/edit/wastage/delete).
  // Deletes always ask for confirmation first since they are permanent.
  const canManage = userRole === 'admin' || userRole === 'stockist';
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [inventoryData, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [wastageItem, setWastageItem] = useState(null);
  const [wastageQty, setWastageQty] = useState('');
  const [wastageReason, setWastageReason] = useState('spoiled');
  const [wastageNotes, setWastageNotes] = useState('');
  // Last-good snapshot timestamp while showing cached stock (null = live).
  const [staleSince, setStaleSince] = useState(null);

  const wastageReasons = ['spoiled', 'expired', 'damaged', 'overproduction', 'other'];

  const [formData, setFormData] = useState({
    name: '', category: 'Ingredients', stock_quantity: '', unit: 'kg'
  });

  const categories = ['Ingredients', 'Dairy', 'Syrups', 'Packaging', 'Fruits', 'Other'];

  async function loadInventory() {
    // Cache-first: paint the last-good snapshot instantly when the list is
    // empty, then revalidate live underneath (no skeleton flash on retries).
    if (inventoryData.length === 0) {
      const snap = loadStockCache()
      if (snap) {
        setInventoryData(snap.items)
        // Painted: clear loading so the early return below doesn't keep
        // the skeleton over usable data while live revalidation runs.
        setLoading(false)
      } else {
        setLoading(true)
      }
    }
    setLoadError(null)
    try {
      const data = await db.getInventory()
      setInventoryData(data || [])
      saveStockCache(data || [])
      setStaleSince(null)
    } catch (err) {
      console.error('Failed to load inventory:', err)
      const snap = loadStockCache()
      if (snap) {
        setInventoryData(snap.items)
        setStaleSince(snap.savedAt)
      } else {
        setLoadError(err.message || 'Failed to load inventory. Please retry.')
      }
    } finally {
      setLoading(false)
    }
    // The database is reachable again — flush anything queued offline, then
    // re-read so freshly synced rows replace optimistic ones below.
    let pending = 0
    try {
      pending = await offlineQueue.size()
    } catch {
      pending = 0
    }
    if (pending > 0) {
      try {
        await processQueue()
        const fresh = await db.getInventory()
        setInventoryData(fresh || [])
        saveStockCache(fresh || [])
      } catch (queueErr) {
        console.error('Failed to flush offline queue:', queueErr)
      }
    }
  }

  useEffect(() => {
    loadInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While showing cached stock, retry quietly in the background and
  // immediately on reconnect so the list heals itself.
  useEffect(() => {
    if (!staleSince) return
    const t = setInterval(() => { loadInventory() }, 30000)
    const onOnline = () => { loadInventory() }
    window.addEventListener('online', onOnline)
    return () => { clearInterval(t); window.removeEventListener('online', onOnline) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleSince]);

  const searchFiltered = inventoryData.filter(item =>
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(item.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pills count within the current search so "Low (3)" always matches
  // what the user is looking at.
  const statusCounts = { all: searchFiltered.length, good: 0, low: 0, out: 0 };
  searchFiltered.forEach(item => { statusCounts[statusKeyOf(item.stock_quantity)] += 1; });

  const filteredData = statusFilter === 'all'
    ? searchFiltered
    : searchFiltered.filter(item => statusKeyOf(item.stock_quantity) === statusFilter);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pagedData = filteredData.slice(pageStart, pageStart + PAGE_SIZE);

  // Selection persists by id across pages and filters; the toolbar resolves
  // it against live data so a deleted item simply disables the buttons.
  const selectedItem = inventoryData.find(i => String(i.id) === String(selectedId)) ?? null;
  const selectedLocked = !!selectedItem?._pendingSync;
  const canActOnSelected = canManage && selectedItem && !selectedLocked;

  const selectedTitle = (verb) => {
    if (!selectedItem) return `Select a row to ${verb}`;
    if (selectedLocked) return 'Will sync when the database is back';
    return undefined;
  };

  // A new search or filter always restarts at page one.
  useEffect(() => { setPage(0); }, [searchTerm, statusFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  const handleOpenAdd = () => {
    setFormData({ name: '', category: 'Ingredients', stock_quantity: '', unit: 'kg' });
    setIsEditing(false);
    setEditId(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setFormData({ name: item.name, category: item.category || 'Other', stock_quantity: item.stock_quantity, unit: item.unit || 'kg' });
    setIsEditing(true);
    setEditId(item.id);
    setShowModal(true);
  };

  // Applies an optimistic change to the list AND the snapshot so queued
  // edits stay visible across reloads until the next live load replaces
  // them with real rows.
  const applyOptimisticList = (next) => {
    setInventoryData(next)
    saveStockCache(next)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.stock_quantity) return;
    const updates = {
      name: formData.name,
      category: formData.category,
      stock_quantity: Number(formData.stock_quantity),
      unit: formData.unit || 'units',
    }
    try {
      if (isEditing && editId) {
        await db.updateInventoryItem(editId, updates)
      } else {
        const created = await db.createInventoryItem({
          name: formData.name,
          category: formData.category,
          stock_quantity: Number(formData.stock_quantity),
          unit: formData.unit || 'units',
        })
        if (isQueuedRecord(created)) {
          // Queued offline: show it now flagged pending-sync (locked from
          // further edits until its real id comes back from sync).
          applyOptimisticList([...inventoryData, { ...created, _pendingSync: true }])
          setShowModal(false)
          alert('Saved offline — will sync when the database is back.')
          return
        }
      }
      setShowModal(false)
      await loadInventory()
    } catch (err) {
      if (isRetryableError(err) && isEditing && editId) {
        try {
          const current = inventoryData.find(i => String(i.id) === String(editId))
          await db.queueInventoryUpdate(editId, updates, { baseStockQty: Number(current?.stock_quantity) })
          applyOptimisticList(inventoryData.map(i =>
            String(i.id) === String(editId) ? { ...i, ...updates } : i
          ))
          setShowModal(false)
          alert('Saved offline — will sync when the database is back.')
        } catch (queueErr) {
          alert('Failed to save: ' + (queueErr?.message || err.message))
        }
        return
      }
      alert('Failed to save: ' + err.message)
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await db.deleteInventoryItem(deleteTarget.id)
      setDeleteTarget(null)
      setSelectedId(null)
      await loadInventory()
    } catch (err) {
      if (isRetryableError(err)) {
        try {
          await db.queueInventoryDelete(deleteTarget.id)
          const id = deleteTarget.id
          applyOptimisticList(inventoryData.filter(i => String(i.id) !== String(id)))
          setDeleteTarget(null)
          setSelectedId(null)
          alert('Delete queued — will sync when the database is back.')
        } catch (queueErr) {
          alert('Failed to delete: ' + (queueErr?.message || err.message))
        } finally {
          setDeleting(false)
        }
        return
      }
      alert('Failed to delete: ' + err.message)
    } finally {
      setDeleting(false)
    }
  };

  const handleOpenWastage = (item) => {
    setWastageItem(item);
    setWastageQty('');
    setWastageReason('spoiled');
    setWastageNotes('');
    setShowWastageModal(true);
  };

  const handleLogWastage = async () => {
    if (!wastageItem || !wastageQty) return;
    const qty = Number(wastageQty);
    const prevQty = Number(wastageItem.stock_quantity);
    const newQty = Math.max(0, prevQty - qty);
    // Tracks whether the adjustment already queued itself (createAdjustment
    // auto-queues on retryable errors) so the replay below doesn't log it
    // a second time.
    let adjustmentQueued = false;
    try {
      const adj = await db.createAdjustment({
        inventory_id: wastageItem.id,
        previous_quantity: prevQty,
        new_quantity: newQty,
        change_amount: -qty,
        reason: wastageReason,
        notes: wastageNotes || null,
      });
      adjustmentQueued = isQueuedRecord(adj);
      await db.updateInventoryItem(wastageItem.id, {
        stock_quantity: newQty,
      });
      setShowWastageModal(false);
      await loadInventory();
    } catch (err) {
      if (isRetryableError(err)) {
        try {
          await db.queueInventoryUpdate(
            wastageItem.id,
            { stock_quantity: newQty },
            {
              baseStockQty: prevQty,
              reason: wastageReason,
              notes: wastageNotes || null,
              skipAdjustment: adjustmentQueued,
            }
          );
          const id = wastageItem.id;
          applyOptimisticList(inventoryData.map(i =>
            String(i.id) === String(id) ? { ...i, stock_quantity: newQty } : i
          ));
          setShowWastageModal(false);
          alert('Wastage logged offline — will sync when the database is back.');
        } catch (queueErr) {
          alert('Failed to log wastage: ' + (queueErr?.message || err.message));
        }
        return;
      }
      alert('Failed to log wastage: ' + err.message);
    }
  };

  const getStatus = (stock) => {
    if (stock <= 0) return 'Out of Stock'
    if (stock < 5) return 'Low Stock'
    return 'Good'
  }

  if (loading) {
    return <div className="page-content"><LoadingSkeleton variant="inventory" /><p className="text-sm text-muted">If this takes over 8s, Supabase timed out — it will fail fast with a retry.</p></div>
  }

  if (loadError && inventoryData.length === 0) {
    return <div className="page-content"><div className="card"><p className="text-danger">Failed to load inventory: {loadError}</p><button className="btn btn-primary mt-2" onClick={() => { setLoading(true); loadInventory(); }}>Retry</button></div></div>
  }

  return (
    <div className="page-content">
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Item' : 'Add Item'}</h3>
              <button className="btn-icon-small" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Item Name</label>
                <input type="text" className="form-input" placeholder="e.g., Almond Milk"
                  value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="form-input" value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="form-row-grid">
                <div className="form-group m-0">
                  <label>Stock Quantity</label>
                  <input type="number" className="form-input" placeholder="0"
                    value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{isEditing ? 'Save' : 'Add Item'}</button>
            </div>
          </div>
        </div>
      )}

      {showWastageModal && wastageItem && (
        <div className="modal-overlay" onClick={() => setShowWastageModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Log Wastage</h3>
              <button className="btn-icon-small" onClick={() => setShowWastageModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted mb-3">Item: <strong>{wastageItem.name}</strong> (Current stock: {wastageItem.stock_quantity})</p>
              <div className="form-group">
                <label>Wasted Quantity</label>
                <input type="number" className="form-input" placeholder="0"
                  value={wastageQty} min="1" max={wastageItem.stock_quantity}
                  onChange={(e) => setWastageQty(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <select className="form-input" value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value)}>
                  {wastageReasons.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea className="form-input" rows="2" placeholder="e.g., batch was left out overnight..."
                  value={wastageNotes} onChange={(e) => setWastageNotes(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowWastageModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleLogWastage}>Log Wastage</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}
            role="dialog" aria-labelledby="delete-item-title" data-testid="delete-confirm-modal"
            style={{ maxWidth: '440px', width: '100%' }}>
            <div className="modal-header">
              <h3 id="delete-item-title">Delete {deleteTarget.name}?</h3>
              <button className="btn-icon-small" disabled={deleting} onClick={() => setDeleteTarget(null)} aria-label="Close delete confirmation"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted m-0">
                This permanently removes <strong>{deleteTarget.name}</strong> ({deleteTarget.stock_quantity} in stock) from inventory.
                Past transactions are kept. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={deleting} onClick={() => setDeleteTarget(null)} data-testid="delete-cancel-btn">Cancel</button>
              <button className="btn btn-primary" disabled={deleting} onClick={handleDeleteConfirm} data-testid="delete-confirm-btn">
                {deleting ? 'Deleting...' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {staleSince && (
        <div
          role="status"
          data-testid="stock-stale-banner"
          className="flex items-center gap-2"
          style={{
            backgroundColor: '#fef5e7',
            border: '1px solid var(--color-warning)',
            color: 'var(--text-main)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <span style={{ flex: 1 }}>
            {`Showing saved stock from ${new Date(staleSince).toLocaleString()} — quantities may differ.`}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
            onClick={() => loadInventory()}
            data-testid="stock-retry-btn"
          >
            Retry
          </button>
        </div>
      )}

      <div className="action-bar">
        <div className="search-bar">
          <Search size={18} className="text-muted" />
          <input type="text" placeholder="Search inventory..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canManage && (
            <>
              <button className="btn btn-primary" onClick={handleOpenAdd}>
                <Plus size={18} /> Add Item
              </button>
              <button className="btn btn-secondary" onClick={() => selectedItem && handleOpenEdit(selectedItem)} disabled={!canActOnSelected} title={selectedTitle('edit')} data-testid="toolbar-edit-btn">
                <Edit size={16} /> Edit
              </button>
              <button className="btn btn-secondary" onClick={() => selectedItem && handleOpenWastage(selectedItem)} disabled={!canActOnSelected} title={selectedTitle('log wastage')} data-testid="toolbar-wastage-btn">
                <AlertCircle size={16} /> Wastage
              </button>
              <button className="btn btn-danger" onClick={() => selectedItem && setDeleteTarget(selectedItem)} disabled={!canActOnSelected} title={selectedTitle('delete')} data-testid="toolbar-delete-btn">
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
          <LowStockBell />
        </div>
      </div>

      {canManage && selectedItem && (
        <p className="selected-chip" data-testid="selected-chip">
          Selected: <strong>{selectedItem.name}</strong> ({selectedItem.stock_quantity} in stock)
          {selectedLocked && ' — pending sync, actions locked'}
        </p>
      )}
      {canManage && !selectedItem && inventoryData.length > 0 && (
        <p className="selected-hint" data-testid="selection-hint">Select a row to edit, log wastage, or delete.</p>
      )}

      <div className="inventory-filter-row" role="radiogroup" aria-label="Filter by stock status">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`btn-filter ${statusFilter === opt.key ? 'active' : ''}`}
            aria-pressed={statusFilter === opt.key}
            data-testid={`status-filter-${opt.key}`}
            onClick={() => setStatusFilter(opt.key)}
          >
            {opt.label} ({statusCounts[opt.key]})
          </button>
        ))}
      </div>

      <div className="card table-card table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              {canManage && <th scope="col" aria-label="Select" style={{ width: '2.5rem' }} />}
              <th>Name</th><th>Category</th><th>Stock</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? pagedData.map(item => {
              const isSelected = String(selectedId) === String(item.id);
              const status = getStatus(item.stock_quantity);
              return (
              <tr
                key={item.id}
                className={`${canManage ? 'row-selectable' : ''} ${isSelected ? 'row-selected' : ''}`}
                aria-selected={canManage ? isSelected : undefined}
                onClick={canManage ? () => setSelectedId(item.id) : undefined}
                onKeyDown={canManage ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(item.id); } } : undefined}
                tabIndex={canManage ? 0 : undefined}
              >
                {canManage && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="radio"
                      name="inventory-selection"
                      className="row-select-radio"
                      checked={isSelected}
                      onChange={() => setSelectedId(item.id)}
                      aria-label={`Select ${item.name}`}
                      data-testid={`select-item-${item.id}`}
                    />
                  </td>
                )}
                <td className="font-semibold">{item.name}</td>
                <td>{item.category || '-'}</td>
                <td>{item.stock_quantity}</td>
                <td>
                  <span className={`badge ${status === 'Good' ? 'badge-success' : 'badge-danger'}`}>
                    {status}
                  </span>
                  {item._pendingSync && (
                    <span className="badge badge-neutral" data-testid={`pending-sync-${item.id}`} title="Saved offline — edits unlock after it syncs" style={{ marginLeft: '0.35rem' }}>
                      Pending sync
                    </span>
                  )}
                </td>
              </tr>
              );
            }) : (
              <tr><td colSpan={canManage ? '5' : '4'} className="text-center py-4 text-muted">
                {inventoryData.length === 0
                  ? 'No items found.'
                  : <>{filteredData.length === 0 && (searchTerm || statusFilter !== 'all') && (
                    <>No {statusFilter === 'all' ? '' : `${STATUS_OPTIONS.find(o => o.key === statusFilter)?.label} `}items{searchTerm ? <> matching &ldquo;{searchTerm}&rdquo;</> : null}.{' '}
                    <button className="btn btn-secondary" onClick={clearFilters} data-testid="clear-filters-btn">Clear filters</button></>
                  )}</>}
              </td></tr>
            )}
          </tbody>
        </table>
        {filteredData.length > 0 && (
          <div className="inventory-pager">
            <span aria-live="polite" data-testid="pager-count">
              Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredData.length)} of {filteredData.length}
            </span>
            <div className="action-buttons">
              <button className="btn btn-secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} data-testid="inv-prev" aria-label="Previous page">Prev</button>
              <button className="btn btn-secondary" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} data-testid="inv-next" aria-label="Next page">Next</button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
