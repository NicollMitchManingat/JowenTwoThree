import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { db } from '../../services/db'

export default function RemoveUnpaidOrderModal({ order, onClose, onRemoved }) {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const remove = async () => {
    if (busy.current) return
    busy.current = true; setRemoving(true); setError('')
    try {
      await db.removeSavedOrder(order.id, order.revision)
      onRemoved(order.id)
    } catch (err) {
      setError(err.message || 'Could not remove this unpaid transaction. Please retry.')
    } finally { busy.current = false; setRemoving(false) }
  }
  return <div className="modal-overlay" onClick={() => !removing && onClose()}>
    <div className="modal-content card" role="dialog" aria-modal="true" aria-labelledby="remove-unpaid-title" style={{ maxWidth: '460px', width: '100%' }} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3 id="remove-unpaid-title">Remove unpaid transaction?</h3>
        <button className="btn-icon-small" aria-label="Close removal confirmation" disabled={removing} onClick={onClose}><X size={18} /></button>
      </div>
      <div className="modal-body">
        <p>Remove <strong>{order.transaction_number}</strong> from saved orders and unpaid transactions?</p>
        <p className="text-sm text-muted">This does not change payments, inventory, or customer traffic. The order record is retained for audit.</p>
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" disabled={removing} onClick={onClose} autoFocus>Cancel</button>
        <button className="btn btn-danger" disabled={removing} onClick={remove}>{removing ? 'Removing…' : 'Remove unpaid transaction'}</button>
      </div>
    </div>
  </div>
}
