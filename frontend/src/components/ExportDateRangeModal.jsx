import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, X } from 'lucide-react'
import { presetReportRange, validateReportRange } from '../utils/reportDateRange'

export default function ExportDateRangeModal({ title, initialRange, description, onClose, onExport }) {
  const fallback = presetReportRange('30d')
  const [from, setFrom] = useState(initialRange?.from || fallback.from)
  const [to, setTo] = useState(initialRange?.to || fallback.to)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const id = useId(), overlay = useRef(null), panel = useRef(null), close = useRef(null)
  const request = useRef(null), working = useRef(false), closeAction = useRef(onClose)
  closeAction.current = onClose
  let validation = ''
  try {
    if (!from || !to) throw new Error('Choose both From and To dates.')
    validateReportRange({ from, to })
  } catch (err) { validation = err.message }

  useLayoutEffect(() => {
    const opener = document.activeElement, dialog = panel.current
    const background = [...document.body.children].filter(element => element !== overlay.current && !element.hasAttribute('inert'))
    background.forEach(element => element.setAttribute('inert', ''))
    close.current?.focus({ preventScroll: true })
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation()
        if (!working.current) closeAction.current()
      } else if (event.key === 'Tab') {
        const targets = [...dialog.querySelectorAll('button, input, select, [tabindex]')]
          .filter(element => !element.disabled && element.getAttribute('tabindex') !== '-1')
        const first = targets[0] || dialog, last = targets.at(-1) || dialog
        if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true })
        }
      }
    }
    const onFocus = event => { if (!dialog.contains(event.target)) (working.current ? dialog : close.current)?.focus({ preventScroll: true }) }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      const controller = request.current
      request.current = null
      controller?.abort()
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocus)
      background.forEach(element => element.removeAttribute('inert'))
      if (opener?.isConnected && !opener.disabled && !opener.closest('[hidden], [inert]')) opener.focus({ preventScroll: true })
    }
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (validation || working.current) return
    working.current = true; setBusy(true); setError('')
    const controller = new AbortController()
    request.current = controller
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      await onExport(validateReportRange({ from, to }), controller.signal)
      if (controller.signal.aborted) throw new Error('Export request timed out. Please retry.')
      if (request.current === controller) closeAction.current()
    } catch (err) {
      if (request.current === controller) setError(controller.signal.aborted ? 'Export request timed out. Please retry.' : err.message || 'Export failed. Please try again.')
    } finally {
      clearTimeout(timer)
      working.current = false
      if (request.current === controller) { request.current = null; setBusy(false) }
    }
  }

  return createPortal(<div ref={overlay} className="modal-overlay" onClick={event => {
    if (event.target === event.currentTarget && !working.current) onClose()
  }}>
    <form ref={panel} className="modal-content card export-range-dialog" role="dialog" aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} tabIndex={-1} onSubmit={submit}>
      <header className="modal-header">
        <h3 id={`${id}-title`}><CalendarDays size={20} aria-hidden="true" />{title}</h3>
        <button ref={close} type="button" className="btn-icon-small" aria-label="Close export" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="export-range-body" aria-busy={busy}>
        <p id={`${id}-description`} className="text-sm text-muted">Choose the dates for this file. Both dates are included, in Manila time. Page filters stay unchanged.{description && <> {description}</>}</p>
        <div className="export-range-presets" aria-label="Export date presets">
          {['today', '7d', '30d'].map((preset, index) => <button key={preset} type="button" className="btn btn-secondary" disabled={busy} onClick={() => {
            const range = presetReportRange(preset); setFrom(range.from); setTo(range.to); setError('')
          }}>{['Today', 'Last 7 days', 'Last 30 days'][index]}</button>)}
        </div>
        <div className="export-range-fields">
          <label htmlFor={`${id}-from`}>From date<input id={`${id}-from`} className="form-input" type="date" required value={from} disabled={busy} onChange={event => { setFrom(event.target.value); setError('') }} /></label>
          <label htmlFor={`${id}-to`}>To date<input id={`${id}-to`} className="form-input" type="date" required value={to} disabled={busy} onChange={event => { setTo(event.target.value); setError('') }} /></label>
        </div>
        {(validation || error) && <p className="text-sm text-danger" role="alert">{validation || error}</p>}
        {busy && <p className="text-sm text-muted" role="status">Preparing your file…</p>}
      </div>
      <footer className="modal-footer">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !!validation}>{busy ? 'Exporting…' : 'Download file'}</button>
      </footer>
    </form>
  </div>, document.body)
}
