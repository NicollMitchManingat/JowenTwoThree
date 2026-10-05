import { useState, useEffect, useRef } from 'react'
import { Bell, BellOff, Loader2, Package, AlertTriangle, X } from 'lucide-react'
import { db } from '../../services/db'
import { loadStockCache } from '../../services/stockCache'

// Exit duration (ms) for the stock-alerts modal — kept in sync with the
// `stockAlertsOut` keyframes in App.css so unmount lands as the fade ends.
export const STOCK_ALERTS_EXIT_MS = 180

// Shared low-stock notification bell (Inventory tab + POS tab).
// Display-only: lists out-of-stock / low-stock items, no edit actions,
// so it is safe for every role.
// `size="small"` matches compact neighbors (POS steppers); default matches
// standard buttons (Inventory "Add Item"). Fixed square in both variants so
// the button never shifts when alerts load or the spinner shows.
export default function LowStockBell({ size = 'default' }) {
  const [lowStockItems, setLowStockItems] = useState([])
  const [outOfStockItems, setOutOfStockItems] = useState([])
  const [lowStockLoading, setLowStockLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  // `closing` keeps the modal mounted while the exit fade plays; without
  // it the dialog would vanish instantly on close (no exit animation).
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef(null)

  const openModal = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setClosing(false)
    setShowModal(true)
    loadAlerts()
  }

  const closeModal = () => {
    if (!showModal || closing) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShowModal(false)
      return
    }
    setClosing(true)
    closeTimer.current = setTimeout(() => {
      setShowModal(false)
      setClosing(false)
      closeTimer.current = null
    }, STOCK_ALERTS_EXIT_MS)
  }

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  const loadAlerts = async () => {
    try {
      setLowStockLoading(true)
      const [lowRes, outRes] = await Promise.allSettled([
        db.getLowStockItems(5),
        db.getOutOfStockItems(),
      ])
      // While the database is unreachable, derive alert counts from the
      // last-good stock snapshot so the bell doesn't read empty offline.
      const snap = (lowRes.status === 'rejected' || outRes.status === 'rejected')
        ? loadStockCache()
        : null
      const snapItems = snap ? snap.items : []
      setLowStockItems(lowRes.status === 'fulfilled'
        ? (lowRes.value || [])
        : snapItems.filter((i) => Number(i.stock_quantity) > 0 && Number(i.stock_quantity) <= 5))
      setOutOfStockItems(outRes.status === 'fulfilled'
        ? (outRes.value || [])
        : snapItems.filter((i) => Number(i.stock_quantity) <= 0))
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

  const outCount = outOfStockItems.length
  const lowCount = lowStockItems.length
  const alertCount = lowCount + outCount
  const hasAlerts = alertCount > 0
  // Out-of-stock is critical (red); low-only is a warning (amber).
  const severity = outCount > 0 ? 'critical' : lowCount > 0 ? 'warning' : 'clear'
  const statusLabel = severity === 'clear'
    ? 'No stock alerts'
    : `Stock alerts: ${alertCount} total (${outCount} out of stock, ${lowCount} low)`

  return (
    <>
      <div className="relative" style={{ position: 'relative' }}>
        <button
          className={`btn btn-secondary stock-bell stock-bell--${size} stock-bell--${severity}`}
          onClick={openModal}
          title={statusLabel}
          aria-label={statusLabel}
          aria-busy={lowStockLoading}
          style={{ position: 'relative' }}
          data-testid="low-stock-bell"
          data-severity={severity}
        >
          {hasAlerts ? <Bell size={18} /> : <BellOff size={18} />}
          {hasAlerts && (
            <span
              className="stock-bell-badges"
              data-testid="low-stock-bell-count"
              data-total={alertCount}
              title={statusLabel}
            >
              {outCount > 0 && (
                <span
                  className="badge badge-danger stock-bell-badge"
                  data-testid="low-stock-bell-out"
                  title={`${outCount} out of stock`}
                  aria-label={`${outCount} out of stock`}
                >
                  {outCount}
                </span>
              )}
              {lowCount > 0 && (
                <span
                  className="badge badge-warning stock-bell-badge"
                  data-testid="low-stock-bell-low"
                  title={`${lowCount} low stock`}
                  aria-label={`${lowCount} low stock`}
                >
                  {lowCount}
                </span>
              )}
            </span>
          )}
          {lowStockLoading && (
            <span className="stock-bell-spinner" aria-hidden="true">
              <Loader2 size={14} className="animate-spin" />
            </span>
          )}
        </button>
      </div>

      {showModal && (
        <div
          className={`modal-overlay stock-alerts-overlay ${closing ? 'stock-alerts-exit' : 'stock-alerts-enter'}`}
          onClick={closeModal}
        >
          <div
            className={`modal-content card stock-alerts-dialog ${closing ? 'stock-alerts-exit' : 'stock-alerts-enter'}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-labelledby="stock-alerts-title" data-testid="stock-alerts-modal"
            data-closing={closing}
            style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-warning" />
                <h3 id="stock-alerts-title">Stock Alerts</h3>
              </div>
              <button className="btn-icon-small" onClick={closeModal} aria-label="Close stock alerts"><X size={18} /></button>
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
              <button className="btn btn-primary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
