import { useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Receipt, X } from 'lucide-react'
import { formatElapsed, formatSessionDateTime } from '../../services/sessionAnalytics'

const peso = value => '₱' + value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SessionDetailsModal({ detail, onClose, onRetry }) {
  const { session, summary, loading, error } = detail
  const id = useId(), overlay = useRef(null), panel = useRef(null), close = useRef(null)

  useLayoutEffect(() => {
    const opener = document.activeElement, dialog = panel.current
    // Match the chart explanation dialog: a body portal avoids table/container
    // clipping, and inert background content keeps focus without moving the page.
    const background = [...document.body.children].filter(element => element !== overlay.current && !element.hasAttribute('inert'))
    background.forEach(element => element.setAttribute('inert', ''))
    close.current?.focus({ preventScroll: true })
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); onClose()
      } else if (event.key === 'Tab') {
        const targets = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]')]
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

  return createPortal(<div ref={overlay} className="modal-overlay session-details-overlay" data-testid="session-details-overlay"
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={panel} className="modal-content card session-details-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
      <header className="modal-header">
        <h3 id={`${id}-title`}><Receipt size={20} aria-hidden="true" />Session Details</h3>
        <button ref={close} type="button" className="btn-icon-small" aria-label="Close session details" onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="session-details-body" aria-busy={loading}>
        <p className="session-details-timezone">Service period · Manila time</p>
        <dl className="session-details-meta">
          <div><dt>Opened</dt><dd>{formatSessionDateTime(session.started_at)}</dd></div>
          <div><dt>Closed</dt><dd>{formatSessionDateTime(session.ended_at)}</dd></div>
          <div><dt>Duration</dt><dd>{formatElapsed(new Date(session.ended_at) - new Date(session.started_at))}</dd></div>
          <div><dt>Started by</dt><dd className="session-details-starter">{session.started_by || '—'}</dd></div>
        </dl>
        {loading ? <p className="session-details-state text-muted" role="status">Loading session summary…</p>
          : error ? <div className="session-details-state" role="alert"><p>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={onRetry}>Retry session details</button></div>
            : summary && <div className="session-details-summary" data-testid="session-handover">
              <div className="session-details-total" data-testid="handover-net-cash"><span>Expected cash</span><strong>{peso(summary.net)}</strong></div>
              <dl className="session-details-metrics">
                <div><dt>Transactions</dt><dd data-testid="handover-orders">{summary.orders} transactions</dd></div>
                <div><dt>Gross sales</dt><dd>{peso(summary.gross)}</dd></div>
                <div><dt>Discounts</dt><dd>{peso(summary.discounts)}</dd></div>
                <div><dt>Refunds</dt><dd data-testid="handover-refunds">{summary.refundCount} refunds <small>(−{peso(summary.refunded)})</small></dd></div>
                <div><dt>Customers</dt><dd>{summary.customers.total}<small>Male {summary.customers.male} · Female {summary.customers.female} · Unspecified {summary.customers.unspecified}</small></dd></div>
                <div><dt>Average per transaction</dt><dd>{peso(summary.avgOrder)}</dd></div>
                <div><dt>Transactions per hour</dt><dd>{summary.salesPerHour.toFixed(1)}</dd></div>
              </dl>
            </div>}
      </div>
      <footer className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Close</button></footer>
    </section>
  </div>, document.body)
}
