import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, X, Sparkles, AlertCircle, ChevronRight } from 'lucide-react';
import { db } from '../services/db';
import LowStockBell from '../components/inventory/LowStockBell';

export default function InventoryPage({ userRole }) {
  // Stockists manage stock day-to-day (add/edit/wastage/delete).
  // Deletes always ask for confirmation first since they are permanent.
  const canManage = userRole === 'admin' || userRole === 'stockist';
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const wastageReasons = ['spoiled', 'expired', 'damaged', 'overproduction', 'other'];

  const [formData, setFormData] = useState({
    name: '', category: 'Ingredients', stock_quantity: '', unit: 'kg'
  });

  const categories = ['Ingredients', 'Dairy', 'Syrups', 'Packaging', 'Fruits', 'Other'];

  async function loadInventory() {
    setLoadError(null)
    try {
      const data = await db.getInventory()
      setInventoryData(data || [])
    } catch (err) {
      console.error('Failed to load inventory:', err)
      setLoadError(err.message || 'Failed to load inventory. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredData = inventoryData.filter(item =>
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(item.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleSave = async () => {
    if (!formData.name || !formData.stock_quantity) return;
    try {
      if (isEditing && editId) {
        await db.updateInventoryItem(editId, {
          name: formData.name,
          category: formData.category,
          stock_quantity: Number(formData.stock_quantity),
          unit: formData.unit || 'units',
        })
      } else {
        await db.createInventoryItem({
          name: formData.name,
          category: formData.category,
          stock_quantity: Number(formData.stock_quantity),
          unit: formData.unit || 'units',
        })
      }
      setShowModal(false)
      await loadInventory()
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await db.deleteInventoryItem(deleteTarget.id)
      setDeleteTarget(null)
      await loadInventory()
    } catch (err) {
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
    try {
      await db.createAdjustment({
        inventory_id: wastageItem.id,
        previous_quantity: prevQty,
        new_quantity: newQty,
        change_amount: -qty,
        reason: wastageReason,
        notes: wastageNotes || null,
      });
      await db.updateInventoryItem(wastageItem.id, {
        stock_quantity: newQty,
      });
      setShowWastageModal(false);
      await loadInventory();
    } catch (err) {
      alert('Failed to log wastage: ' + err.message);
    }
  };

  const getStatus = (stock) => {
    if (stock <= 0) return 'Out of Stock'
    if (stock < 5) return 'Low Stock'
    return 'Good'
  }

  if (loading) {
    return <div className="page-content"><div className="card"><p className="text-muted">Loading inventory...</p><p className="text-sm text-muted">If this takes over 8s, Supabase timed out — it will fail fast with a retry.</p></div></div>
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

      <div className="action-bar">
        <div className="search-bar">
          <Search size={18} className="text-muted" />
          <input type="text" placeholder="Search inventory..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {canManage && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={18} /> Add Item
            </button>
          )}
          <LowStockBell />
        </div>
      </div>

      <div className="card table-card table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Stock</th><th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? filteredData.map(item => (
              <tr key={item.id}>
                <td className="font-semibold">{item.name}</td>
                <td>{item.category || '-'}</td>
                <td>{item.stock_quantity}</td>
                <td>
                  <span className={`badge ${getStatus(item.stock_quantity) === 'Low Stock' ? 'badge-danger' : getStatus(item.stock_quantity) === 'Out of Stock' ? 'badge-danger' : 'badge-success'}`}>
                    {getStatus(item.stock_quantity)}
                  </span>
                </td>
                {canManage && (
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon-small" onClick={() => handleOpenWastage(item)} title="Log Wastage"><AlertCircle size={14} /></button>
                      <button className="btn-icon-small" onClick={() => handleOpenEdit(item)} title="Edit item"><Edit size={14} /></button>
                      <button className="btn-icon-small danger" onClick={() => setDeleteTarget(item)} title="Delete item" data-testid={`delete-item-${item.id}`}><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td colSpan={canManage ? "5" : "4"} className="text-center py-4 text-muted">No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
