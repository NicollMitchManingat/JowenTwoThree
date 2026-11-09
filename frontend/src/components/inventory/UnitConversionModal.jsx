import { useEffect, useRef, useState } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { db } from '../../services/db'
import { offlineQueue } from '../../services/offlineQueue'
import { formatStock, formatUnitPrice, formatInventoryMoney } from '../../utils/formatStock'

const TARGETS = { kg: ['g'], g: ['kg'], L: ['mL'], mL: ['L'] }
const LABELS = { kg: 'kg', kilogram: 'kg', kilograms: 'kg', g: 'g', gram: 'g', grams: 'g',
  l: 'L', liter: 'L', litre: 'L', liters: 'L', litres: 'L', ml: 'mL', milliliter: 'mL',
  millilitre: 'mL', milliliters: 'mL', millilitres: 'mL' }
const canonical = value => {
  const label = String(value || '').trim().toLowerCase()
  return Object.hasOwn(LABELS, label) ? LABELS[label] : undefined
}

// Values displayed here are server quotes, never calculations from rounded rows.
export default function UnitConversionModal({ item, onClose, onSuccess }) {
  const source = canonical(item.unit)
  const correction = !!source && item.unit !== source
  const targets = correction ? [source] : TARGETS[source] || []
  const [target, setTarget] = useState(targets[0] || '')
  const [reason, setReason] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [online, setOnline] = useState(navigator.onLine !== false)
  const operationKey = useRef(null), pending = useRef(false), dialog = useRef(null)
  const previewHeading = useRef(null)
  const expired = receipt && now >= Date.parse(receipt.expiresAt)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    const network = () => setOnline(navigator.onLine !== false)
    window.addEventListener('online', network); window.addEventListener('offline', network)
    const previous = document.activeElement
    dialog.current?.querySelector('button, select, textarea')?.focus()
    return () => {
      clearInterval(timer); window.removeEventListener('online', network); window.removeEventListener('offline', network)
      previous?.focus()
    }
  }, [])
  useEffect(() => { if (receipt) previewHeading.current?.focus() }, [receipt])
  useEffect(() => { if (busy) dialog.current?.focus() }, [busy])

  const reset = () => { setReceipt(null); setConfirmed(false); operationKey.current = null; setError(''); setRetry(false) }
  const checkQueue = async () => {
    // Unknown legacy entries cannot safely be interpreted in a newly chosen unit.
    const entries = await offlineQueue.dequeueAll()
    if (entries.some(op => op.method !== 'authorized-inventory' || String(op.body?.id) === String(item.id))) {
      throw Object.assign(new Error('Review and sync pending stock changes before changing this unit.'), { status: 409 })
    }
  }
  const preview = async () => {
    if (pending.current || !online || !target || !reason.trim()) return
    pending.current = true; setBusy(true); setError(''); setReceipt(null); setConfirmed(false)
    try {
      await checkQueue()
      const result = await db.previewInventoryUnitChange(item.id, {
        targetUnit: target, kind: correction ? 'label_correction' : 'conversion', reason: reason.trim(),
      })
      const q = result?.quote
      if (!q || q.inventoryId !== item.id || !Array.isArray(q.recipes) || q.recipes.length !== q.recipeCount ||
        !/^unit-preview:[0-9a-f-]{36}$/i.test(result.previewKey || '') || !/^[0-9a-f]{64}$/.test(result.previewDigest || '') ||
        !Number.isFinite(Date.parse(result.expiresAt)) || q.unitAfter !== target ||
        ['quantityBefore','quantityAfter','thresholdBefore','thresholdAfter','factor'].some(key => typeof q[key] !== 'string' || formatStock(q[key]) === '-') ||
        ['priceBefore','priceAfter','valueBefore','valueAfter'].some(key => q[key] !== null && (typeof q[key] !== 'string' || formatStock(q[key]) === '-')) ||
        q.recipes.some(line => !line || typeof line.productId !== 'string' || typeof line.productName !== 'string' ||
          ['quantityBefore','quantityAfter'].some(key => typeof line[key] !== 'string' || formatStock(line[key]) === '-'))) {
        throw new Error('The preview could not be verified. Request a fresh preview.')
      }
      operationKey.current = crypto.randomUUID(); setRetry(false); setNow(Date.now()); setReceipt(result)
    } catch (err) { setError(err.message || 'Unable to preview this unit change.') }
    finally { pending.current = false; setBusy(false) }
  }
  const confirm = async () => {
    if (pending.current || !receipt || !online || (!retry && (expired || !confirmed || receipt.confirmationAvailable !== true))) return
    pending.current = true; setBusy(true); setError('')
    try {
      await checkQueue()
      const result = await db.confirmInventoryUnitChange(item.id, {
        previewKey: receipt.previewKey, previewDigest: receipt.previewDigest, operationKey: operationKey.current,
      })
      setRetry(false)
      onSuccess(result)
    } catch (err) {
      // Unknown results must retry the SAME key, even after expiry. SQL returns
      // an already committed result before checking expiry/readiness again.
      if (err.code === 'UNIT_CONVERSION_NOT_READY') {
        setReceipt(previous => ({ ...previous, confirmationAvailable: false })); setRetry(false); setError(err.message)
      } else if (!err.status || err.status >= 500) {
        setRetry(true)
        setError(`${err.message || 'The result could not be verified.'} Retry this confirmation to check its result. This action is never saved offline.`)
      } else {
        setReceipt(null); setRetry(false); setConfirmed(false); operationKey.current = null
        setError(`${err.message || 'The item changed.'} Reload the item and review a new preview before continuing.`)
      }
    } finally { pending.current = false; setBusy(false) }
  }
  const close = () => { if (!pending.current) onClose() }
  const onKeyDown = event => {
    if (event.key === 'Escape') { event.stopPropagation(); close() }
    if (event.key === 'Tab') {
      const nodes = [...dialog.current.querySelectorAll('button:not(:disabled), select:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (!nodes.length) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === previewHeading.current || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }
  const quote = receipt?.quote
  const rows = quote ? [
    ['Quantity', formatStock(quote.quantityBefore), formatStock(quote.quantityAfter)],
    ['Price per unit', quote.priceBefore == null ? 'Not recorded' : formatUnitPrice(quote.priceBefore), quote.priceAfter == null ? 'Not recorded' : formatUnitPrice(quote.priceAfter)],
    ['Low-stock threshold', formatStock(quote.thresholdBefore), formatStock(quote.thresholdAfter)],
    ['Total Amount', quote.valueBefore == null ? 'Not recorded' : formatInventoryMoney(quote.valueBefore), quote.valueAfter == null ? 'Not recorded' : formatInventoryMoney(quote.valueAfter)],
  ] : []

  return <div className="modal-overlay" onClick={close}>
    <div ref={dialog} tabIndex={-1} className="modal-content card unit-conversion-modal" role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby="unit-change-title" onClick={event => event.stopPropagation()} onKeyDown={onKeyDown}>
      <div className="modal-header"><h3 id="unit-change-title">Change unit</h3><button className="btn-icon-small" disabled={busy} aria-label="Close unit change" onClick={close}><X size={18} /></button></div>
      <div className="modal-body">
        <p className="text-sm"><strong>{item.name}</strong> · Current unit: {item.unit || 'Not recorded'}</p>
        {!online && <p role="status" className="text-warning">Connect to the internet to preview or confirm a unit change.</p>}
        {!source ? <p role="status">This ingredient uses an unclassified unit. Review its physical unit and every linked recipe before conversion. Generic “units” cannot be guessed.</p> : <>
          {correction && <p className="text-sm text-muted">First standardize the equivalent label to {source}. Quantities and prices stay the same for this label correction.</p>}
          <fieldset disabled={busy || retry} className="inventory-item-fields">
            <div className="form-group"><label htmlFor="unit-change-target">New unit</label><select id="unit-change-target" className="form-input" value={target} onChange={event => { reset(); setTarget(event.target.value) }}>{targets.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></div>
            <div className="form-group"><label htmlFor="unit-change-reason">Reason</label><textarea id="unit-change-reason" className="form-input" rows="2" maxLength={1000} value={reason} onChange={event => { reset(); setReason(event.target.value) }} /></div>
          </fieldset>
          <p className="text-sm text-muted">Review exact quantities and prices below. All linked recipe quantities change together; past transactions and stock adjustments are preserved.</p>
        </>}
        {error && <p role="alert" className="text-danger">{error}</p>}
        {quote && <section aria-labelledby="unit-preview-title">
          <h4 id="unit-preview-title" ref={previewHeading} tabIndex={-1}>{quote.unitBefore} <ArrowRight size={16} aria-hidden="true" /> {quote.unitAfter}</h4>
          <p className="text-sm">Quantity factor: ×{formatStock(quote.factor)}. Prices use the inverse factor.</p>
          <table className="data-table unit-preview-table"><thead><tr><th>Field</th><th>Before ({quote.unitBefore})</th><th>After ({quote.unitAfter})</th></tr></thead><tbody>{rows.map(([label, before, after]) => <tr key={label}><th scope="row">{label}</th><td>{before}</td><td>{after}</td></tr>)}</tbody></table>
          <h4>Linked recipes ({quote.recipeCount})</h4>
          {quote.recipes.length ? <table className="data-table unit-preview-table"><thead><tr><th>Product</th><th>Before ({quote.unitBefore})</th><th>After ({quote.unitAfter})</th></tr></thead><tbody>{quote.recipes.map(line => <tr key={line.productId}><th scope="row">{line.productName}</th><td>{formatStock(line.quantityBefore)}</td><td>{formatStock(line.quantityAfter)}</td></tr>)}</tbody></table> : <p className="text-sm text-muted">No linked recipes.</p>}
          {receipt.confirmationAvailable !== true && <p role="status" className="text-warning">Unit conversion is not enabled yet. You can review this preview; confirmation will be available after the coordinated release.</p>}
          {expired && !retry && <p role="status" className="text-warning">This preview expired. Request a new preview.</p>}
          <label className="unit-change-ack"><input type="checkbox" checked={confirmed} disabled={busy || retry || expired || receipt.confirmationAvailable !== true} onChange={event => setConfirmed(event.target.checked)} />I reviewed the units, prices, threshold and every linked recipe.</label>
        </section>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" disabled={busy} onClick={close}>Close</button>
        {source && !retry && <button className="btn btn-secondary" disabled={busy || !online || !reason.trim()} onClick={preview}>{busy && !receipt ? 'Loading…' : receipt ? 'Refresh preview' : 'Preview change'}</button>}
        {receipt && <button className="btn btn-primary" disabled={busy || !online || (!retry && (!confirmed || expired || receipt.confirmationAvailable !== true))} onClick={confirm}>{busy ? 'Confirming…' : retry ? 'Retry confirmation' : 'Confirm unit change'}</button>}
      </div>
    </div>
  </div>
}
