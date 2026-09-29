import { useState, useMemo } from 'react'
import { X, Lock } from 'lucide-react'
import { db } from '../../services/db'
import { verifyManagerPassword } from '../../services/managerApproval'

export const REFUND_REASONS = [
  'Wrong item served',
  'Customer complaint',
  'Spoiled / quality issue',
  'Double-charged',
  'Change of mind',
  'Other',
]

export function lineKey(line) {
  return String(line?.productId ?? line?.product_id ?? line?.name ?? '')
}

// Total qty already refunded per line key across prior refunds.
export function summarizeRefundedQty(refunds) {
  const map = {}
  ;(refunds || []).forEach((r) => {
    ;(Array.isArray(r.items) ? r.items : []).forEach((it) => {
      const k = lineKey(it)
      map[k] = (map[k] || 0) + (Number(it.qty) || 0)
    })
  })
  return map
}

export function priorRefundedTotal(refunds) {
  return (refunds || []).reduce((s, r) => s + (Number(r.refund_amount) || 0), 0)
}

// Pro-rata share of the order total for the selected lines, so an
// order-level discount is split fairly. Capped at the unrefunded balance.
export function computeRefundAmount(order, selections) {
  const subtotal = Number(order?.subtotal) || 0
  const total = Number(order?.total) || 0
  if (subtotal <= 0 || total <= 0) return 0
  const selectedShare = (selections || []).reduce(
    (s, sel) => s + (Number(sel.price) || 0) * (Number(sel.qty) || 0),
    0
  )
  if (selectedShare <= 0) return 0
  const remaining = Math.max(0, total - priorRefundedTotal(order?.__refunds))
  const amount = Math.round(((selectedShare / subtotal) * total + Number.EPSILON) * 100) / 100
  return Math.min(amount, remaining)
}

// Full + partial (line-item) refunds. Money-only — inventory is untouched.
// Admin confirms directly; staff must enter the manager (admin) password.
// The cashier session never changes; approval is recorded as approved_by.
export default function RefundModal({ order, user, existingRefunds = [], onClose, onRefunded }) {
  const lines = useMemo(
    () => (Array.isArray(order?.cart) ? order.cart : []),
    [order]
  )
  const refundedQty = useMemo(() => summarizeRefundedQty(existingRefunds), [existingRefunds])
  const [qtyByKey, setQtyByKey] = useState({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isAdmin = user?.role === 'admin'

  const remainingFor = (line) => {
    const ordered = Number(line.qty ?? line.quantity) || 0
    return Math.max(0, ordered - (refundedQty[lineKey(line)] || 0))
  }

  const selections = lines
    .map((line) => ({ ...line, qty: Math.min(Number(qtyByKey[lineKey(line)]) || 0, remainingFor(line)) }))
    .filter((line) => line.qty > 0)

  const amount = computeRefundAmount({ ...order, __refunds: existingRefunds }, selections)
  const allRemainingSelected = lines.length > 0 && lines.every((line) => {
    const selected = Math.min(Number(qtyByKey[lineKey(line)]) || 0, remainingFor(line))
    return selected >= remainingFor(line) && remainingFor(line) >= 0
  }) && selections.length > 0

  const setLineQty = (line, qty) => {
    setQtyByKey((prev) => ({ ...prev, [lineKey(line)]: Math.max(0, Math.min(remainingFor(line), Math.floor(Number(qty) || 0))) }))
  }

  const selectFullOrder = () => {
    const next = {}
    lines.forEach((line) => { next[lineKey(line)] = remainingFor(line) })
    setQtyByKey(next)
  }

  const isValid = selections.length > 0 && amount > 0 && reason !== '' && (isAdmin || managerPassword !== '')

  const handleConfirm = async () => {
    setError('')
    let approvedBy = user?.username
    if (!isAdmin) {
      const check = verifyManagerPassword(managerPassword)
      if (!check.success) {
        setError(check.error)
        return
      }
      approvedBy = check.username
    }
    setSaving(true)
    try {
      const items = selections.map((line) => ({
        productId: line.productId ?? line.product_id ?? null,
        name: line.name,
        price: Number(line.price) || 0,
        qty: line.qty,
      }))
      await db.createRefund({
        transaction_id: order.id,
        items,
        refund_amount: amount,
        reason,
        notes,
        approved_by: approvedBy,
        created_by: user?.username,
      })
      await db.updateTransactionStatus(
        order.id,
        lines.every((line) => (refundedQty[lineKey(line)] || 0) + Math.min(Number(qtyByKey[lineKey(line)]) || 0, remainingFor(line)) >= (Number(line.qty ?? line.quantity) || 0))
          ? 'REFUNDED'
          : 'PARTIALLY_REFUNDED'
      )
      onRefunded?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Failed to record refund')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose?.()} data-testid="refund-modal-overlay">
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-labelledby="refund-title" data-testid="refund-modal"
        style={{ maxWidth: '560px', width: '100%' }}>
        <div className="modal-header">
          <h3 id="refund-title">Refund {order?.transaction_number}</h3>
          <button className="btn-icon-small" disabled={saving} onClick={onClose} aria-label="Close refund">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && <p className="text-danger" data-testid="refund-error">{error}</p>}

          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold m-0">Products to refund</p>
            <button className="btn btn-secondary" disabled={saving} onClick={selectFullOrder} data-testid="refund-full-btn">
              Select full order
            </button>
          </div>

          {lines.length === 0 && <p className="text-muted">No item detail on this transaction.</p>}
          {lines.map((line, idx) => {
            const remaining = remainingFor(line)
            const selected = Math.min(Number(qtyByKey[lineKey(line)]) || 0, remaining)
            return (
              <div key={`${lineKey(line)}-${idx}`} className="cart-item" data-testid={`refund-line-${idx}`}>
                <div className="item-info">
                  <h5>{line.name}</h5>
                  <p className="item-price">
                    ₱{Number(line.price).toFixed(2)} × {line.qty ?? line.quantity} ordered
                    {refundedQty[lineKey(line)] > 0 && ` · ${refundedQty[lineKey(line)]} already refunded`}
                  </p>
                </div>
                <div className="item-controls">
                  <button className="btn-icon-small" disabled={saving || selected <= 0}
                    onClick={() => setLineQty(line, selected - 1)}
                    aria-label={`Decrease refund qty for ${line.name}`}
                    data-testid={`refund-line-${idx}-dec`}>−</button>
                  <span className="qty" data-testid={`refund-line-${idx}-qty`}>{selected}/{remaining}</span>
                  <button className="btn-icon-small" disabled={saving || selected >= remaining}
                    onClick={() => setLineQty(line, selected + 1)}
                    aria-label={`Increase refund qty for ${line.name}`}
                    data-testid={`refund-line-${idx}-inc`}>+</button>
                </div>
              </div>
            )
          })}

          <div className="form-group mt-3">
            <label>Reason for refund <span className="text-danger">*</span></label>
            <select className="form-input" value={reason} onChange={(e) => setReason(e.target.value)}
              data-testid="refund-reason" disabled={saving}>
              <option value="">Select a reason...</option>
              {REFUND_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea className="form-input" placeholder="e.g., drink spilled before serving..."
              value={notes} onChange={(e) => setNotes(e.target.value)}
              data-testid="refund-notes" disabled={saving} />
          </div>

          {!isAdmin && (
            <div className="form-group">
              <label className="flex items-center gap-2"><Lock size={14} /> Manager password <span className="text-danger">*</span></label>
              <input type="password" className="form-input" placeholder="Ask a manager to enter their password"
                value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)}
                data-testid="refund-manager-password" disabled={saving} />
              <p className="text-sm text-muted">Your session stays signed in as {user?.username}.</p>
            </div>
          )}

          <div className="summary-row total">
            <span>Refund amount{allRemainingSelected ? ' (full order)' : ''}</span>
            <span data-testid="refund-amount">₱{amount.toFixed(2)}</span>
          </div>
          <p className="text-sm text-muted">Money-only refund. Inventory is not restocked.</p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" disabled={saving} onClick={onClose} data-testid="refund-cancel">Cancel</button>
          <button className="btn btn-primary" disabled={saving || !isValid} onClick={handleConfirm} data-testid="refund-confirm">
            {saving ? 'Recording...' : `Confirm refund ₱${amount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
