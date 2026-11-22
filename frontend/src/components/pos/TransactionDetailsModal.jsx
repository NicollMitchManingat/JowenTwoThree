import { useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Receipt, X } from 'lucide-react'
import { orderTypeLabel, paymentStatusFor } from '../../services/transactionAPI'
import { formatSessionDateTime } from '../../services/sessionAnalytics'

const amount = value => value == null || value === '' || !Number.isFinite(Number(value)) ? 'Not recorded'
  : Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
const recordedDate = value => value && Number.isFinite(new Date(value).getTime()) ? formatSessionDateTime(value) : 'Not recorded'

export default function TransactionDetailsModal({ order, refunds = [], historyError, onClose }) {
  const id = useId(), overlay = useRef(null), panel = useRef(null), close = useRef(null)
  const unpaid = paymentStatusFor(order) === 'UNPAID'
  const items = Array.isArray(order.cart) ? order.cart.filter(item => item && typeof item === 'object') : []
  const refunded = refunds.reduce((sum, refund) => sum + (Number(refund.refund_amount) || 0), 0)
  const refundStatus = order.status === 'REFUNDED' ? 'Refunded' : order.status === 'PARTIALLY_REFUNDED' ? 'Partially refunded' : refunds.length ? 'Refund recorded' : 'No refunds recorded'

  useLayoutEffect(() => {
    const opener = document.activeElement, dialog = panel.current
    const background = [...document.body.children].filter(element => element !== overlay.current && !element.hasAttribute('inert'))
    background.forEach(element => element.setAttribute('inert', ''))
    close.current?.focus({ preventScroll: true })
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); onClose()
      } else if (event.key === 'Tab') {
        const targets = [...dialog.querySelectorAll('button, [href], [tabindex]')]
          .filter(element => !element.disabled && element.getAttribute('tabindex') !== '-1')
        const first = targets[0] || dialog, last = targets.at(-1) || dialog
        if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true })
        }
      }
    }
    const onFocus = event => { if (!dialog.contains(event.target)) close.current?.focus({ preventScroll: true }) }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocus)
      background.forEach(element => element.removeAttribute('inert'))
      if (opener?.isConnected && !opener.disabled && !opener.closest('[hidden], [inert]')) opener.focus({ preventScroll: true })
    }
  }, [onClose])

  return createPortal(<div ref={overlay} className="modal-overlay transaction-details-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={panel} className="modal-content card transaction-details-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
      <header className="modal-header">
        <h3 id={`${id}-title`}><Receipt size={20} aria-hidden="true" />Transaction Details</h3>
        <button ref={close} type="button" className="btn-icon-small" aria-label="Close transaction details" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="transaction-details-body">
        <div className="transaction-details-heading"><strong>{order.transaction_number || 'Not recorded'}</strong>
          <span className={`badge ${unpaid ? 'badge-warning' : 'badge-success'}`}>{unpaid ? 'Unpaid' : 'Paid'}</span></div>
        {historyError && <p role="alert" className="text-danger">History could not be refreshed. These details show the last successful load.</p>}
        <dl className="transaction-details-meta">
          <div><dt>Date (Manila)</dt><dd>{recordedDate(order.created_at)}</dd></div>
          <div><dt>Order type</dt><dd>{orderTypeLabel(order.order_type)}</dd></div>
          <div><dt>Payment method</dt><dd>{unpaid ? 'Awaiting payment' : order.payment_method || 'Not recorded'}</dd></div>
          <div><dt>Customers</dt><dd>{order.customer_count ?? 'Not recorded'}
            {[order.male_count, order.female_count, order.unspecified_count].some(value => value != null) && <small>Male {order.male_count ?? '—'} · Female {order.female_count ?? '—'} · Unspecified {order.unspecified_count ?? '—'}</small>}</dd></div>
        </dl>
        <section aria-labelledby={`${id}-items`}><h4 id={`${id}-items`}>Items</h4>
          {items.length ? <table className="transaction-details-items" aria-label="Transaction items">
            <colgroup><col style={{ width: '46%' }} /><col style={{ width: '12%' }} /><col style={{ width: '21%' }} /><col style={{ width: '21%' }} /></colgroup>
            <thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead>
            <tbody>{items.map((item, index) => {
              const qty = item.qty ?? item.quantity, price = item.price ?? item.unit_price
              const lineAmount = item.subtotal ?? (qty != null && price != null && Number.isFinite(Number(qty)) && Number.isFinite(Number(price)) ? Number(qty) * Number(price) : null)
              return <tr key={item.cartItemId || index}><td><strong>{item.name || item.product_name || 'Item name not recorded'}</strong>{item.note && <small>{item.note}</small>}</td>
                <td>{qty ?? '—'}</td><td>{amount(price)}</td><td>{amount(lineAmount)}</td></tr>
            })}</tbody>
          </table> : <p className="text-muted">Item details were not recorded for this transaction.</p>}
        </section>
        {order.special_instructions && <section><h4>Special instructions</h4><p className="transaction-details-note">{order.special_instructions}</p></section>}
        <dl className="transaction-details-totals">
          <div><dt>Subtotal</dt><dd>{amount(order.subtotal)}</dd></div>
          <div><dt>Discount{order.discount_label && order.discount_label !== 'None' ? ` (${order.discount_label})` : ''}</dt><dd>{amount(order.discount)}</dd></div>
          <div className="transaction-details-total"><dt>{unpaid ? 'Amount due' : 'Transaction total'}</dt><dd>{amount(order.total)}</dd></div>
          {!unpaid && <><div><dt>Cash received</dt><dd>{order.payment_method === 'CASH' ? amount(order.cash_received) : 'Not applicable'}</dd></div>
            <div><dt>Change</dt><dd>{order.payment_method === 'CASH' ? amount(order.change_amount) : 'Not applicable'}</dd></div></>}
        </dl>
        {unpaid ? <p className="text-muted transaction-details-note">This saved order has not been paid. Prices, discounts and stock are checked again when payment is completed.</p>
          : <section aria-labelledby={`${id}-refunds`}><h4 id={`${id}-refunds`}>Refunds</h4>
            <div className="transaction-details-heading"><span>{refundStatus}</span><strong>{!refunds.length && ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.status) ? 'Amount not recorded' : amount(refunded)}</strong></div>
            {refunds.length > 0 && <ul className="transaction-details-refunds">{refunds.map((refund, index) => <li key={refund.id || index}>
              <div><strong>{refund.reason || 'Reason not recorded'}</strong><small>{recordedDate(refund.created_at)}</small></div><span>{amount(refund.refund_amount)}</span>
            </li>)}</ul>}
          </section>}
      </div>
      <footer className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button></footer>
    </section>
  </div>, document.body)
}
