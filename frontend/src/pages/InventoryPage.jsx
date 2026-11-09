import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit, Trash2, X, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { db, isRetryableError, isQueuedRecord } from '../services/db';
import LowStockBell from '../components/inventory/LowStockBell';
import UnitConversionModal from '../components/inventory/UnitConversionModal';
import LoadingSkeleton from '../components/analytics/LoadingSkeleton';
import { saveStockCache, loadStockCache } from '../services/stockCache';
import { formatStock, formatInventoryMoney, inventoryTotal, formatUnitPrice, inventoryStatus, lowStockThreshold, compareStock, subtractStock } from '../utils/formatStock';
import { processQueue, offlineQueue } from '../services/offlineQueue';

const PAGE_SIZE = 10;
const quantityInput = value => Number(value).toLocaleString('en-US', {
  useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const isRowControl = target => !!target.closest('input, button, select, textarea, a, [role="button"]');
const stockVersion = item => ({ baseStockQty: item?.stock_quantity,
  ...(item?.unit_version != null ? { expectedUnitVersion: String(item.unit_version) } : {}),
  ...(item?.updated_at ? { expectedUpdatedAt: item.updated_at } : {}) });

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'good', label: 'Good' },
  { key: 'low', label: 'Low Stock' },
  { key: 'out', label: 'Out of Stock' },
];

const statusKeyOf = inventoryStatus;

export default function InventoryPage({ userRole }) {
  // Stockman staff manage stock day-to-day.
  // Archiving retains the item and its adjustment history.
  const canManage = userRole === 'admin' || userRole === 'stockist';
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [conversionItem, setConversionItem] = useState(null);
  const [unitNotice, setUnitNotice] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editVersion, setEditVersion] = useState(null);
  const [originalItem, setOriginalItem] = useState(null);
  const [quantityEdited, setQuantityEdited] = useState(false);
  const touch = useRef({ active: null, lastTap: null, ignoreClickId: null, ignoreClickUntil: 0, ignoreDoubleClickUntil: 0 });
  const [saving, setSaving] = useState(false);
  const saveBusy = useRef(false);
  const [formError, setFormError] = useState('');
  const [alertRefreshKey, setAlertRefreshKey] = useState(0);
  const [inventoryData, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [wastageItem, setWastageItem] = useState(null);
  const [wastageQty, setWastageQty] = useState('');
  const [wastageReason, setWastageReason] = useState('spoiled');
  const [wastageNotes, setWastageNotes] = useState('');
  const [wastageError, setWastageError] = useState('');
  const [loggingWastage, setLoggingWastage] = useState(false);
  const wastageBusy = useRef(false);
  // Last-good snapshot timestamp while showing cached stock (null = live).
  const [staleSince, setStaleSince] = useState(null);

  const wastageReasons = ['spoiled', 'expired', 'damaged', 'overproduction', 'other'];

  const [formData, setFormData] = useState({
    name: '', category: 'Ingredients', stock_quantity: '', unit: 'units', unit_price: '', low_stock_threshold: '5'
  });

  const categories = ['Ingredients', 'Dairy', 'Syrups', 'Packaging', 'Fruits', 'Other'];

  async function loadInventory() {
    // Cache-first: paint the last-good snapshot instantly when the list is
    // empty, then revalidate live underneath (no skeleton flash on retries).
    if (inventoryData.length === 0) {
      const snap = loadStockCache()
      if (snap) {
        setInventoryData(snap.items)
        setStaleSince(snap.savedAt)
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
  searchFiltered.forEach(item => { statusCounts[statusKeyOf(item)] += 1; });

  const filteredData = statusFilter === 'all'
    ? searchFiltered
    : searchFiltered.filter(item => statusKeyOf(item) === statusFilter);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pagedData = filteredData.slice(pageStart, pageStart + PAGE_SIZE);

  // Selection persists by id across pages and filters; the toolbar resolves
  // it against live data so a deleted item simply disables the buttons.
  const selectedItem = inventoryData.find(i => String(i.id) === String(selectedId)) ?? null;
  const selectedLocked = !!selectedItem?._pendingSync;
  const canActOnSelected = canManage && selectedItem && !selectedLocked;

  // Clicking the selected row again unselects it — otherwise there is no
  // way to return to the "nothing selected" state.
  const toggleSelect = (id) => {
    setSelectedId(prev => (prev !== null && String(prev) === String(id) ? null : id));
  };

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
    setFormData({ name: '', category: 'Ingredients', stock_quantity: '', unit: 'units', unit_price: '', low_stock_threshold: '5' });
    setFormError(''); setOriginalItem(null); setQuantityEdited(false);
    setIsEditing(false);
    setEditId(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    if (!canManage || item._pendingSync || showModal) return;
    setSelectedId(item.id);
    setFormData({ name: item.name, category: item.category || 'Other', stock_quantity: quantityInput(item.stock_quantity), unit: item.unit || 'units', unit_price: item.unit_price ?? '', low_stock_threshold: String(lowStockThreshold(item)) });
    setFormError(''); setOriginalItem(item); setQuantityEdited(false);
    setIsEditing(true);
    setEditId(item.id);
    setEditVersion(stockVersion(item));
    setShowModal(true);
  };

  const resetTouch = () => { touch.current.active = null; touch.current.lastTap = null; };
  useEffect(() => {
    const cancelMultiTouch = event => {
      if (event.pointerType === 'touch' && event.isPrimary === false) resetTouch();
    };
    window.addEventListener('scroll', resetTouch, true);
    window.addEventListener('pointerdown', cancelMultiTouch, true);
    return () => {
      window.removeEventListener('scroll', resetTouch, true);
      window.removeEventListener('pointerdown', cancelMultiTouch, true);
    };
  }, []);

  const handleTouchDown = (event, item) => {
    if (event.pointerType !== 'touch') return;
    const now = Date.now();
    touch.current.ignoreDoubleClickUntil = now + 700;
    if (!canManage || item._pendingSync || showModal || event.isPrimary === false || isRowControl(event.target)) {
      resetTouch(); return;
    }
    touch.current.active = { id: item.id, pointer: event.pointerId, x: event.clientX, y: event.clientY, time: now };
  };

  const handleTouchMove = event => {
    if (event.pointerType !== 'touch') return;
    const active = touch.current.active;
    if (active && active.pointer === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10) resetTouch();
  };

  const handleTouchUp = (event, item) => {
    if (event.pointerType !== 'touch') return;
    const active = touch.current.active, previous = touch.current.lastTap, now = Date.now();
    touch.current.active = null;
    if (!active || active.pointer !== event.pointerId || active.id !== item.id ||
      now - active.time < 0 || now - active.time > 300 ||
      Math.hypot(event.clientX - active.x, event.clientY - active.y) > 10 || isRowControl(event.target)) {
      touch.current.lastTap = null; return;
    }
    if (previous && previous.id === item.id && now - previous.time >= 0 && now - previous.time <= 300 &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 24) {
      resetTouch();
      // Compatibility click/dblclick events must not deselect the row or reopen.
      touch.current.ignoreClickId = item.id;
      touch.current.ignoreClickUntil = now + 500;
      handleOpenEdit(item);
    } else touch.current.lastTap = { id: item.id, time: now, x: event.clientX, y: event.clientY };
  };

  const exactFormQuantity = isEditing && !quantityEdited ? originalItem?.stock_quantity : formData.stock_quantity;

  // Applies an optimistic change to the list AND the snapshot so queued
  // edits stay visible across reloads until the next live load replaces
  // them with real rows.
  const applyOptimisticList = (next) => {
    setInventoryData(next)
    saveStockCache(next)
  }

  const handleSave = async () => {
    if (saveBusy.current || !canManage) return;
    const quantity = Number(isEditing && !quantityEdited ? originalItem?.stock_quantity : quantityInput(formData.stock_quantity));
    const priceText = String(formData.unit_price).trim();
    const thresholdText = String(formData.low_stock_threshold).trim();
    const thresholdUnchanged = isEditing && compareStock(thresholdText, lowStockThreshold(originalItem)) === 0;
    if (!formData.name.trim()) { setFormError('Item name is required.'); return; }
    if (String(formData.stock_quantity).trim() === '' || !Number.isFinite(quantity) || Number(formData.stock_quantity) < 0) { setFormError('Quantity must be zero or a positive number.'); return; }
    if (!formData.unit.trim() || formData.unit.trim().length > 32) { setFormError('Unit is required (up to 32 characters).'); return; }
    if (!thresholdUnchanged && (!/^\d+(\.\d+)?$/.test(thresholdText) || thresholdText.length > 128 || !Number.isFinite(Number(thresholdText)))) { setFormError('Low stock threshold must be zero or a positive decimal number (up to 128 characters).'); return; }
    const priceUnchanged = isEditing && priceText === String(originalItem?.unit_price ?? '');
    const exactPrice = isEditing && Number(originalItem?.unit_version) > 0;
    if (!priceUnchanged && priceText !== '' && (!(exactPrice ? /^\d+(\.\d+)?$/ : /^\d+(\.\d{1,2})?$/).test(priceText) || priceText.length > 128 || compareStock(priceText, '9999999999.99') > 0)) { setFormError(exactPrice ? 'Enter a nonnegative unit price (maximum 9,999,999,999.99; up to 128 characters).' : 'Price must be nonnegative, with at most two decimal places (maximum 9,999,999,999.99).'); return; }
    saveBusy.current = true; setSaving(true); setFormError('');
    const updates = {
      name: formData.name.trim(),
      category: formData.category,
      unit: formData.unit.trim(),
    }
    // Metadata-only edits must not rewrite high-precision stored balances.
    if (!isEditing || (quantityEdited && compareStock(quantity, originalItem?.stock_quantity) !== 0)) updates.stock_quantity = quantity;
    if (!thresholdUnchanged) updates.low_stock_threshold = thresholdText;
    const unitPrice = priceText === '' ? null : exactPrice ? priceText : Number(priceText);
    if (!isEditing || (unitPrice === null ? originalItem?.unit_price != null : originalItem?.unit_price == null || compareStock(unitPrice, originalItem.unit_price) !== 0)) updates.unit_price = unitPrice;
    try {
      if (isEditing && editId) {
        await db.updateInventoryItem(editId, updates, editVersion)
      } else {
        const created = await db.createInventoryItem(updates)
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
      if (Object.hasOwn(updates, 'low_stock_threshold')) setAlertRefreshKey(key => key + 1)
    } catch (err) {
      if (isRetryableError(err) && isEditing && editId) {
        try {
          await db.queueInventoryUpdate(editId, updates, { ...editVersion, ...(err.command || {}) })
          applyOptimisticList(inventoryData.map(i =>
            String(i.id) === String(editId) ? { ...i, ...updates, total_amount: inventoryTotal(updates.stock_quantity ?? i.stock_quantity, Object.hasOwn(updates, 'unit_price') ? updates.unit_price : i.unit_price) } : i
          ))
          setShowModal(false)
          alert('Saved offline — will sync when the database is back.')
        } catch (queueErr) {
          alert('Failed to save: ' + (queueErr?.message || err.message))
        }
        return
      }
      setFormError('Failed to save: ' + err.message)
    } finally { saveBusy.current = false; setSaving(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await db.deleteInventoryItem(deleteTarget.id, stockVersion(deleteTarget))
      setDeleteTarget(null)
      setSelectedId(null)
      await loadInventory()
    } catch (err) {
      if (isRetryableError(err)) {
        try {
          await db.queueInventoryDelete(deleteTarget.id, err.command || stockVersion(deleteTarget))
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
    setWastageError('');
    setShowWastageModal(true);
  };

  const handleLogWastage = async () => {
    if (!wastageItem || wastageBusy.current || !canManage) return;
    const qty = Number(wastageQty);
    const prevQty = Number(wastageItem.stock_quantity);
    if (!Number.isFinite(qty) || compareStock(wastageQty, 0) <= 0 || !Number.isFinite(compareStock(wastageQty, prevQty)) || compareStock(wastageQty, wastageItem.stock_quantity) > 0) { setWastageError('Wasted quantity must be greater than zero and no more than the available quantity.'); return; }
    const newQty = typeof wastageItem.stock_quantity === 'string' ? subtractStock(wastageItem.stock_quantity, wastageQty) : prevQty - qty;
    wastageBusy.current = true; setLoggingWastage(true); setWastageError('');
    // The server commits the quantity and adjustment together.
    try {
      await db.updateInventoryItem(wastageItem.id, {
        stock_quantity: newQty,
      }, { ...stockVersion(wastageItem), reason: wastageReason, notes: wastageNotes || null });
      setShowWastageModal(false);
      await loadInventory();
    } catch (err) {
      if (isRetryableError(err)) {
        try {
          await db.queueInventoryUpdate(
            wastageItem.id,
            { stock_quantity: newQty },
            {
              ...stockVersion(wastageItem),
              reason: wastageReason,
              notes: wastageNotes || null,
              ...(err.command || {}),
            }
          );
          const id = wastageItem.id;
          applyOptimisticList(inventoryData.map(i =>
            String(i.id) === String(id) ? { ...i, stock_quantity: newQty, total_amount: inventoryTotal(newQty, i.unit_price) } : i
          ));
          setShowWastageModal(false);
          alert('Wastage logged offline — will sync when the database is back.');
        } catch (queueErr) {
          alert('Failed to log wastage: ' + (queueErr?.message || err.message));
        }
        return;
      }
      setWastageError('Failed to log wastage: ' + err.message);
    } finally { wastageBusy.current = false; setLoggingWastage(false); }
  };

  const getStatus = item => ({ out: 'Out of Stock', low: 'Low Stock', good: 'Good' })[inventoryStatus(item)]

  if (loading) {
    return <div className="page-content"><LoadingSkeleton variant="inventory" /><p className="text-sm text-muted">If this takes over 8s, Supabase timed out — it will fail fast with a retry.</p></div>
  }

  if (loadError && inventoryData.length === 0) {
    return <div className="page-content"><div className="card"><p className="text-danger">Failed to load inventory: {loadError}</p><button className="btn btn-primary mt-2" onClick={() => { setLoading(true); loadInventory(); }}>Retry</button></div></div>
  }

  return (
    <div className="page-content record-list-page inventory-list-page">
      {unitNotice && <p role="status" className="text-success">{unitNotice}</p>}
      {conversionItem && userRole === 'admin' && <UnitConversionModal key={conversionItem.id} item={conversionItem}
        onClose={() => setConversionItem(null)} onSuccess={() => { setConversionItem(null); setUnitNotice('Unit change completed.'); loadInventory(); }} />}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content card inventory-item-modal" role="dialog" aria-label={isEditing ? 'Edit Item' : 'Add Item'} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Item' : 'Add Item'}</h3>
              <button className="btn-icon-small" disabled={saving} aria-label="Close item form" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {formError && <p role="alert" className="text-danger">{formError}</p>}
              <fieldset disabled={saving} className="inventory-item-fields">
              <div className="form-group">
                <label htmlFor="inventory-item-name">Item Name</label>
                <input id="inventory-item-name" type="text" className="form-input" placeholder="e.g., Almond Milk"
                  value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="inventory-category">Category</label>
                <select id="inventory-category" className="form-input" value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  {!categories.includes(formData.category) && <option value={formData.category}>{formData.category}</option>}
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="form-row-grid">
                <div className="form-group m-0">
                  <label htmlFor="inventory-quantity">Quantity</label>
                  <input id="inventory-quantity" type="number" className="form-input" placeholder="0" min="0" step="0.01"
                    value={formData.stock_quantity} onChange={(e) => { setQuantityEdited(true); setFormData({ ...formData, stock_quantity: e.target.value }); }}
                    onBlur={e => {
                      const value = e.target.value;
                      if (value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0) setFormData(previous => ({ ...previous, stock_quantity: quantityInput(value) }));
                    }} />
                </div>
                <div className="form-group m-0">
                  <label htmlFor="inventory-unit">Unit</label>
                  <input id="inventory-unit" type="text" className="form-input" maxLength={32} placeholder="e.g., kg, L, pcs" value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })} />
                </div>
              </div>
              <p className="text-sm text-muted">Quantity and price use this unit. Ordinary edits do not convert units. Admins can select the item and use Change unit to review a conversion.</p>
              {isEditing && <p className="text-sm text-muted">Exact balance: {formatStock(originalItem?.stock_quantity)} {originalItem?.unit}. The quantity input uses two decimal places; leaving it unchanged preserves this balance.</p>}
              <div className="form-group">
                <label htmlFor="inventory-threshold">Low stock threshold</label>
                <input id="inventory-threshold" type="number" className="form-input" min="0" step="any" aria-describedby="inventory-threshold-help"
                  value={formData.low_stock_threshold} onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })} />
                <p id="inventory-threshold-help" className="text-sm text-muted">Alert when quantity is at or below this level in {formData.unit.trim() || 'the item\u2019s unit'}. Set to 0 for out-of-stock alerts only.</p>
              </div>
              <div className="form-group">
                <label htmlFor="inventory-price">Price per {formData.unit.trim() || 'unit'} (₱)</label>
                <input id="inventory-price" type="number" className="form-input" placeholder="Not recorded" min="0" max="9999999999.99" step={Number(originalItem?.unit_version) > 0 ? 'any' : '0.01'}
                  value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: e.target.value })} />
                <p className="text-sm text-muted">Leave blank if the price is not recorded.</p>
              </div>
              <div className="flex justify-between items-center">
                <span>Status</span><span>{getStatus({ ...originalItem, stock_quantity: exactFormQuantity, low_stock_threshold: formData.low_stock_threshold })}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span>Total Amount</span><output aria-label="Total Amount">{formatInventoryMoney(inventoryTotal(exactFormQuantity, formData.unit_price))}</output>
              </div>
              </fieldset>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={saving} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Saving…' : isEditing ? 'Save' : 'Add Item'}</button>
            </div>
          </div>
        </div>
      )}

      {showWastageModal && wastageItem && (
        <div className="modal-overlay" onClick={() => !loggingWastage && setShowWastageModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Log Wastage</h3>
              <button className="btn-icon-small" disabled={loggingWastage} aria-label="Close wastage form" onClick={() => setShowWastageModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {wastageError && <p role="alert" className="text-danger">{wastageError}</p>}
              <p className="text-sm text-muted mb-3">Item: <strong>{wastageItem.name}</strong> (Current quantity: {formatStock(wastageItem.stock_quantity)} {wastageItem.unit || 'units'})</p>
              <div className="form-group">
                <label>Wasted Quantity</label>
                <input type="number" className="form-input" placeholder="0" disabled={loggingWastage}
                  value={wastageQty} min="0" step="any" max={wastageItem.stock_quantity}
                  onChange={(e) => setWastageQty(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <select className="form-input" disabled={loggingWastage} value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value)}>
                  {wastageReasons.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea className="form-input" disabled={loggingWastage} rows="2" placeholder="e.g., batch was left out overnight..."
                  value={wastageNotes} onChange={(e) => setWastageNotes(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" disabled={loggingWastage} onClick={() => setShowWastageModal(false)}>Cancel</button>
              <button className="btn btn-danger" disabled={loggingWastage} onClick={handleLogWastage}>{loggingWastage ? 'Saving…' : 'Log Wastage'}</button>
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
                This removes <strong>{deleteTarget.name}</strong> ({formatStock(deleteTarget.stock_quantity, { wholeNumber: true })} in stock) from active inventory.
                Past transactions and inventory adjustments are kept.
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
              {userRole === 'admin' && <button className="btn btn-secondary" disabled={!canActOnSelected || !!staleSince} title={staleSince ? 'Refresh live inventory before changing units' : selectedTitle('change unit')}
                onClick={() => { setUnitNotice(''); setConversionItem(selectedItem) }} data-testid="toolbar-unit-change-btn"><ArrowRightLeft size={16} /> Change unit</button>}
              <button className="btn btn-secondary" onClick={() => selectedItem && handleOpenWastage(selectedItem)} disabled={!canActOnSelected} title={selectedTitle('log wastage')} data-testid="toolbar-wastage-btn">
                <AlertCircle size={16} /> Wastage
              </button>
              <button className="btn btn-danger" onClick={() => selectedItem && setDeleteTarget(selectedItem)} disabled={!canActOnSelected} title={selectedTitle('delete')} data-testid="toolbar-delete-btn">
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
          <LowStockBell refreshKey={alertRefreshKey} />
        </div>
      </div>

      {canManage && selectedItem && (
        <p className="selected-chip" data-testid="selected-chip">
          Selected: <strong>{selectedItem.name}</strong> ({formatStock(selectedItem.stock_quantity, { wholeNumber: true })} in stock)
          {selectedLocked && ' — pending sync, actions locked'}
        </p>
      )}
      {canManage && !selectedItem && inventoryData.length > 0 && (
        <p className="selected-hint" data-testid="selection-hint">Double-click or double-tap a row to edit, or select a row to use Edit, Log Wastage or Delete above.</p>
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

      <p className="text-sm text-muted m-0">Quantities are rounded to the nearest whole number for display. Totals and stock operations use exact quantities.</p>
      <div className="record-table-layout">
      <div className="card table-card table-responsive record-table">
        <table className="data-table" role="table" aria-label="Inventory items">
          <colgroup>
            {canManage && <col style={{ width: '4%' }} />}
            {[23, 12, 10, 8, 17, 14, 16].map((width, index) => <col key={index} style={{ width: `${width * (canManage ? 0.96 : 1)}%` }} />)}
          </colgroup>
          <thead role="rowgroup">
            <tr role="row">
              {canManage && <th scope="col" aria-label="Select" />}
              <th>Item Name</th><th>Category</th><th className="record-numeric-heading">Quantity</th><th className="record-unit-heading">Unit</th><th className="record-numeric-heading">Price per Unit</th><th>Status</th><th className="record-numeric-heading">Total Amount</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {filteredData.length > 0 ? pagedData.map(item => {
              const isSelected = String(selectedId) === String(item.id);
              const status = getStatus(item);
              return (
              <tr
                role="row"
                key={item.id}
                className={`${canManage ? 'row-selectable' : ''} ${isSelected ? 'row-selected' : ''}`}
                aria-selected={canManage ? isSelected : undefined}
                onClick={canManage ? event => {
                  if (event.detail !== 0 && touch.current.ignoreClickId === item.id && Date.now() < touch.current.ignoreClickUntil) return;
                  toggleSelect(item.id);
                } : undefined}
                onDoubleClick={canManage ? event => {
                  if (Date.now() < touch.current.ignoreDoubleClickUntil || isRowControl(event.target)) return;
                  handleOpenEdit(item);
                } : undefined}
                onPointerDown={canManage ? event => handleTouchDown(event, item) : undefined}
                onPointerMove={canManage ? handleTouchMove : undefined}
                onPointerUp={canManage ? event => handleTouchUp(event, item) : undefined}
                onPointerCancel={canManage ? resetTouch : undefined}
                onKeyDown={canManage ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSelect(item.id); }
                  else if (e.key === 'Escape') { setSelectedId(null); }
                } : undefined}
                tabIndex={canManage ? 0 : undefined}
              >
                {canManage && (
                  <td role="cell" data-label="Select" className="record-select-cell" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="radio"
                      name="inventory-selection"
                      className="row-select-radio"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.name}`}
                      data-testid={`select-item-${item.id}`}
                    />
                  </td>
                )}
                <td role="cell" data-label="Item Name" className="font-semibold record-title-cell">{item.name}</td>
                <td role="cell" data-label="Category">{item.category || '-'}</td>
                <td role="cell" data-label="Quantity">{formatStock(item.stock_quantity, { wholeNumber: true })}</td>
                <td role="cell" data-label="Unit">{item.unit || 'units'}</td>
                <td role="cell" data-label="Price per Unit">{item.unit_price == null ? <span className="text-muted">Not recorded</span> : <span>{formatUnitPrice(item.unit_price)} / {item.unit || 'units'}</span>}</td>
                <td role="cell" data-label="Status">
                  <span className={`badge ${status === 'Good' ? 'badge-success' : status === 'Low Stock' ? 'badge-warning' : 'badge-danger'}`}>
                    {status}
                  </span>
                  {item._pendingSync && (
                    <span className="badge badge-neutral" data-testid={`pending-sync-${item.id}`} title="Saved offline — edits unlock after it syncs">
                      Pending sync
                    </span>
                  )}
                </td>
                <td role="cell" data-label="Total Amount">{formatInventoryMoney(item.total_amount ?? inventoryTotal(item.stock_quantity, item.unit_price))}</td>
              </tr>
              );
            }) : (
              <tr><td colSpan={canManage ? '8' : '7'} className="text-center py-4 text-muted">
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

    </div>
  );
}
