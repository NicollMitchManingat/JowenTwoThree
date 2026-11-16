import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, X } from 'lucide-react'

const peso = value => '₱' + value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function DiscountApprovalModal({ discountLabel, subtotal, discountAmount, requestedBy, password, error, busy, onPasswordChange, onAuthorize, onClose }) {
  const id = useId(), overlay = useRef(null), panel = useRef(null), input = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const actions = useRef({ busy, onClose })
  actions.current = { busy, onClose }

  useLayoutEffect(() => {
    const opener = document.activeElement, dialog = panel.current
    const background = [...document.body.children].filter(element => element !== overlay.current && !element.hasAttribute('inert'))
    background.forEach(element => element.setAttribute('inert', ''))
    input.current?.focus({ preventScroll: true })
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation()
        if (!actions.current.busy) actions.current.onClose()
      } else if (event.key === 'Tab') {
        const targets = [...dialog.querySelectorAll('button, input, [tabindex]')]
          .filter(element => !element.disabled && element.getAttribute('tabindex') !== '-1')
        if (!targets.length) { event.preventDefault(); dialog.focus({ preventScroll: true }); return }
        const first = targets[0] || dialog, last = targets.at(-1) || dialog
        if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true })
        }
      }
    }
    const onFocus = event => {
      if (!dialog.contains(event.target)) (actions.current.busy ? dialog : input.current)?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocus)
      background.forEach(element => element.removeAttribute('inert'))
      if (opener?.isConnected && !opener.disabled && !opener.closest('[hidden], [inert]')) opener.focus({ preventScroll: true })
    }
  }, [])

  useLayoutEffect(() => {
    if (error && !busy) input.current?.focus({ preventScroll: true })
  }, [error, busy])

  return createPortal(<div ref={overlay} className="modal-overlay discount-approval-overlay" onClick={event => {
    if (event.target === event.currentTarget && !busy) onClose()
  }}>
    <form ref={panel} className="modal-content card discount-approval-dialog" role="dialog" aria-modal="true"
      aria-label="Authorize discount" aria-describedby={`${id}-description`} tabIndex={-1}
      onSubmit={event => { event.preventDefault(); if (!busy && password) void onAuthorize() }}>
      <header className="discount-approval-header">
        <span className="discount-approval-symbol"><ShieldCheck size={24} aria-hidden="true" /></span>
        <div><p className="discount-approval-eyebrow">Discount authorization</p><h3>Admin approval required</h3></div>
        <button type="button" className="btn-icon-small discount-approval-close" aria-label="Close discount approval" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="discount-approval-body">
        <p id={`${id}-description`} className="text-sm text-muted">An administrator must approve this discount before it can be applied.</p>
        <section className="discount-approval-summary" aria-label="Discount preview">
          <div className="discount-approval-selection"><span>Requested discount</span><strong>{discountLabel}</strong></div>
          <dl>
            <div><dt>Order subtotal</dt><dd>{peso(subtotal)}</dd></div>
            <div className="discount-approval-saving"><dt>Discount</dt><dd>−{peso(discountAmount)}</dd></div>
            <div className="discount-approval-total"><dt>Total after discount</dt><dd>{peso(Math.max(0, subtotal - discountAmount))}</dd></div>
          </dl>
          <p className="discount-approval-preview-note">Preview amounts. Approval applies to this order only.</p>
        </section>
        <div className="discount-approval-password">
          <label htmlFor={`${id}-password`}>Admin password</label>
          <div className="discount-approval-password-field">
            <LockKeyhole size={18} className="discount-approval-lock" aria-hidden="true" />
            <input ref={input} id={`${id}-password`} name="discount-admin-password" className="form-input"
              type={showPassword ? 'text' : 'password'} autoComplete="off" placeholder="Enter administrator password"
              value={password} onChange={event => onPasswordChange(event.target.value)} disabled={busy} required
              aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} />
            <button type="button" className="discount-approval-password-toggle" disabled={busy}
              aria-label={showPassword ? 'Hide admin password' : 'Show admin password'} aria-pressed={showPassword}
              onClick={() => setShowPassword(value => !value)}>
              {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
            </button>
          </div>
          <p id={`${id}-hint`} className="text-sm text-muted">You’ll stay signed in as {requestedBy || 'the current cashier'}.</p>
        </div>
        {error && <div id={`${id}-error`} className="discount-approval-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><p>{error}</p></div>}
      </div>
      <footer className="modal-footer discount-approval-actions" aria-busy={busy}>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !password}>
          {busy ? <Loader2 size={17} className="discount-approval-spinner" aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}
          {busy ? 'Authorizing…' : 'Authorize discount'}
        </button>
        {busy && <span className="sr-only" role="status">Checking administrator approval…</span>}
      </footer>
    </form>
  </div>, document.body)
}
