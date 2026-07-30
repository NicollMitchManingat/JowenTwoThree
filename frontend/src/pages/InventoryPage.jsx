import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, X, Sparkles, AlertCircle, Bell, BellOff, Loader2, Package, AlertTriangle, ChevronRight } from 'lucide-react';
import { db } from '../services/db';

export default function InventoryPage({ userRole }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [inventoryData, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [wastageItem, setWastageItem] = useState(null);
  const [wastageQty, setWastageQty] = useState('');
  const [wastageReason, setWastageReason] = useState('spoiled');
  const [wastageNotes, setWastageNotes] = useState('');

  const wastageReasons = ['spoiled', 'expired', 'damaged', 'overproduction', 'other'];

  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [outOfStockItems, setOutOfStockItems] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '', category: 'Ingredients', stock_quantity: '', unit: 'kg'
  });

  const categories = ['Ingredients', 'Dairy', 'Syrups', 'Packaging', 'Fruits', 'Other'];

  useEffect(() => {
    loadInventory()
  }, [])

  async function loadInventory() {
    try {
      const data = await db.getInventory()
      setInventoryData(data)
    } catch (err) {
      console.error('Failed to load inventory:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadLowStockAlerts() {
    try {
      setLowStockLoading(true);
      const [lowStock, outOfStock] = await Promise.all([
        db.getLowStockItems(5),
        db.getOutOfStockItems()
      ]);
      setLowStockItems(lowStock || []);
      setOutOfStockItems(outOfStock || []);
    } catch (err) {
      console.error('Failed to load low stock alerts:', err);
    } finally {
      setLowStockLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
    loadLowStockAlerts();
  }, []);

  const filteredData = inventoryData.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id?.toLowerCase().includes(searchTerm.toLowerCase())
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
        })
      } else {
        await db.createInventoryItem({
          name: formData.name,
          category: formData.category,
          stock_quantity: Number(formData.stock_quantity),
        })
      }
      setShowModal(false)
      await loadInventory()
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.deleteInventoryItem(id)
      await loadInventory()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
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
    return <div className="page-content"><div className="card"><p className="text-muted">Loading inventory...</p></div></div>
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

      <div className="action-bar">
        <div className="search-bar">
          <Search size={18} className="text-muted" />
          <input type="text" placeholder="Search inventory..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {userRole === 'admin' && (
            <button className="btn btn-primary" onClick={handleOpenAdd}>
              <Plus size={18} /> Add Item
            </button>
          )}
          <div className="relative" style={{ position: 'relative' }}>
            <button
              className={`btn btn-secondary ${(lowStockItems.length > 0 || outOfStockItems.length > 0) ? 'text-danger' : ''}`}
              onClick={() => { setShowLowStockModal(true); loadLowStockAlerts(); }}
              title="Low Stock Alerts"
              style={{ position: 'relative' }}
            >
              {(lowStockItems.length > 0 || outOfStockItems.length > 0) ? <Bell size={18} /> : <BellOff size={18} />}
              {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
                <span className="absolute -top-1 -right-1 bg-danger text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
                  style={{ minWidth: '20px', height: '20px', fontSize: '10px', lineHeight: '1', top: '-6px', right: '-6px' }}>
                  {lowStockItems.length + outOfStockItems.length}
                </span>
              )}
              {lowStockLoading && <Loader2 size={16} className="animate-spin" />}
            </button>
          </div>
        </div>
      </div>

      <div className="card table-card table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Stock</th><th>Status</th>
              {userRole === 'admin' && <th>Actions</th>}
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
                {userRole === 'admin' && (
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon-small" onClick={() => handleOpenWastage(item)} title="Log Wastage"><AlertCircle size={14} /></button>
                      <button className="btn-icon-small" onClick={() => handleOpenEdit(item)}><Edit size={14} /></button>
                      <button className="btn-icon-small danger" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td colSpan={userRole === 'admin' ? "5" : "4"} className="text-center py-4 text-muted">No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showLowStockModal && (
        <div className="modal-overlay" onClick={() => setShowLowStockModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-warning" />
                <h3>Stock Alerts</h3>
              </div>
              <button className="btn-icon-small" onClick={() => setShowLowStockModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {lowStockLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="ml-2 text-muted">Loading alerts...</span>
                </div>
              ) : (outOfStockItems.length === 0 && lowStockItems.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BellOff size={48} className="text-success mb-4 opacity-50" />
                  <p className="font-semibold text-lg mb-1">All Stocked Up!</p>
                  <p className="text-muted">No low stock or out of stock items.</p>
                </div>
              ) : (
                <>
                  {outOfStockItems.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold text-danger flex items-center gap-2 mb-3">
                        <Package size={16} /> Out of Stock ({outOfStockItems.length})
                      </h4>
                      <div className="stock-list">
                        {outOfStockItems.map(item => (
                          <div key={item.id} className="stock-item stock-item-danger">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted">{item.category || 'Uncategorized'}</p>
                            </div>
                            <span className="badge badge-danger">0 {item.unit || 'units'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lowStockItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-warning flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} /> Low Stock ({lowStockItems.length})
                      </h4>
                      <div className="stock-list">
                        {lowStockItems.map(item => (
                          <div key={item.id} className="stock-item stock-item-warning">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted">{item.category || 'Uncategorized'}</p>
                            </div>
                            <span className="badge badge-warning">{item.stock_quantity} {item.unit || 'units'} left</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowLowStockModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
