import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2, Package, AlertTriangle, X } from 'lucide-react'
import { db } from '../../services/db'

// Shared low-stock notification bell (Inventory tab + POS tab).
// Display-only: lists out-of-stock / low-stock items, no edit actions,
// so it is safe for every role.
export default function LowStockBell() {
  const [lowStockItems, setLowStockItems] = useState([])
  const [outOfStockItems, setOutOfStockItems] = useState([])
  const [lowStockLoading, setLowStockLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const loadAlerts = async () => {
    try {
      setLowStockLoading(true)
      const [lowRes, outRes] = await Promise.allSettled([
        db.getLowStockItems(5),
        db.getOutOfStockItems(),
      ])
      setLowStockItems(lowRes.status === 'fulfilled' ? (lowRes.value || []) : [])
      setOutOfStockItems(outRes.status === 'fulfilled' ? (outRes.value || []) : [])
      if (lowRes.status === 'rejected') console.error('Failed to load low stock alerts:', lowRes.reason)
      if (outRes.status === 'rejected') console.error('Failed to load low stock alerts:', outRes.reason)
    } catch (err) {
      console.error('Failed to load low stock alerts:', err)
    } finally {
      setLowStockLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!cancelled) await loadAlerts()
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const alertCount = lowStockItems.length + outOfStockItems.length
  const hasAlerts = alertCount > 0

  return (
    <>
      <div className="relative" style={{ position: 'relative' }}>
        <button
          className={`btn btn-secondary ${hasAlerts ? 'text-danger' : ''}`}
          onClick={() => { setShowModal(true); loadAlerts(); }}
          title="Low Stock Alerts"
          style={{ position: 'relative' }}
          data-testid="low-stock-bell"
        >
          {hasAlerts ? <Bell size={18} /> : <BellOff size={18} />}
          {hasAlerts && (
            <span className="absolute -top-1 -right-1 bg-danger text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
              style={{ minWidth: '20px', height: '20px', fontSize: '10px', lineHeight: '1', top: '-6px', right: '-6px' }}
              data-testid="low-stock-bell-count">
              {alertCount}
            </span>
          )}
          {lowStockLoading && <Loader2 size={16} className="animate-spin" />}
        </button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}
            role="dialog" aria-labelledby="stock-alerts-title" data-testid="stock-alerts-modal"
            style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-warning" />
                <h3 id="stock-alerts-title">Stock Alerts</h3>
              </div>
              <button className="btn-icon-small" onClick={() => setShowModal(false)} aria-label="Close stock alerts"><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {lowStockLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="ml-2 text-muted">Loading alerts...</span>
                </div>
              ) : (!hasAlerts) ? (
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
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
