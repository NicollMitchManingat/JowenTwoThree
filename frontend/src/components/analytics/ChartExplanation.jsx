import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CalendarDays, ClipboardCheck, LoaderCircle, Sparkles, X } from 'lucide-react'
import { apiRequest } from '../../services/apiClient'
import { chartEvidence } from '../../services/chartFacts'
import { useChartExplanation, useChartFacts, useRefreshCharts } from './ChartFactsContext'

function validExplanation(data, chartId) {
  return data?.chartId === chartId && ['template', 'gemini', 'groq'].includes(data.source) &&
    Array.isArray(data.observations) && data.observations.length > 0 && data.observations.length <= 3 &&
    Array.isArray(data.actions) && data.actions.length <= 1 &&
    [...data.observations, ...data.actions].every(row => typeof row.id === 'string' && typeof row.text === 'string' && row.text.length <= 2000) &&
    Array.isArray(data.limitations) && data.limitations.every(row => typeof row === 'string' && row.length <= 2000)
}

export default function ChartExplanation({ chartId }) {
  const facts = useChartFacts(chartId), refresh = useRefreshCharts(), id = useId()
  const explanations = useChartExplanation(), [result, setResult] = useState(null)
  const open = explanations?.active === id
  const trigger = useRef(null), overlay = useRef(null), panel = useRef(null), closeButton = useRef(null)
  const request = useRef(null)
  const identity = facts?.identity
  const current = result?.identity === identity ? result : null
  const available = facts && ['ready', 'empty', 'insufficient_history'].includes(facts.status)
  useEffect(() => {
    request.current?.abort(); request.current = null
    return () => { request.current?.abort(); request.current = null }
  }, [identity])
  useEffect(() => {
    if (!open) { request.current?.abort(); request.current = null }
  }, [open])
  const dismiss = () => {
    request.current?.abort(); request.current = null
    explanations?.close(id)
  }
  const closeExplanation = explanations?.close
  useEffect(() => () => closeExplanation?.(id), [closeExplanation, id])

  useLayoutEffect(() => {
    if (!open) return
    const opener = trigger.current, dialog = panel.current
    // Keep the existing page scrollbars and widths in place. The portal is a
    // body sibling, so making the application inert never contains the dialog.
    const background = [...document.body.children].filter(element => element !== overlay.current && !element.hasAttribute('inert'))
    background.forEach(element => element.setAttribute('inert', ''))
    closeButton.current?.focus({ preventScroll: true })
    const focusable = () => [...dialog.querySelectorAll('button, [href], summary, [tabindex]')]
      .filter(element => !element.disabled && element.getAttribute('tabindex') !== '-1' && !element.closest('[hidden], [inert]'))
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation()
        request.current?.abort(); request.current = null; closeExplanation?.(id)
      } else if (event.key === 'Tab') {
        const targets = focusable(), first = targets[0] || dialog, last = targets.at(-1) || dialog
        if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true })
        }
      }
    }
    const onFocus = event => { if (!dialog.contains(event.target)) closeButton.current?.focus({ preventScroll: true }) }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocus)
      background.forEach(element => element.removeAttribute('inert'))
      if (opener?.isConnected && !opener.disabled && !opener.closest('[hidden], [inert]')) opener.focus({ preventScroll: true })
    }
  }, [open, closeExplanation, id])

  async function explain() {
    if (!available || request.current) return
    const controller = new AbortController()
    request.current = controller
    setResult({ identity, status: 'loading' })
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; controller.abort() }, 20000)
    try {
      if (navigator.onLine === false) throw new Error('Connect to the internet to request an explanation.')
      const response = await apiRequest('/api/ai-insights/charts/explain', {
        method: 'POST', signal: controller.signal,
        body: { chartId, scope: facts.scope, view: facts.view, expected: chartEvidence(facts) },
      })
      if (!validExplanation(response?.data, chartId)) throw new Error('The explanation is incomplete. Please retry.')
      if (request.current === controller && !controller.signal.aborted) setResult({ identity, status: 'ready', data: response.data })
    } catch (err) {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) {
        setResult({ identity, status: 'error', changed: err.code === 'CHART_CHANGED',
          message: timedOut ? 'Explanation timed out. Please retry.' : err.message || 'Explanation unavailable. Please retry.' })
      }
    } finally {
      clearTimeout(timeout)
      if (request.current === controller) request.current = null
    }
  }
  const toggle = () => {
    if (open) dismiss()
    else { explanations?.open(id); if (!current || current.status !== 'ready') void explain() }
  }
  const ready = current?.status === 'ready'
  return <>
    <button ref={trigger} type="button" className="btn btn-secondary chart-explain-button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      disabled={!available && !open} onClick={toggle} title={available ? 'Explain the verified chart data' : 'Wait for complete chart data'}>
      <Sparkles size={15} aria-hidden="true" />Explain chart
    </button>
    {open && createPortal(<div ref={overlay} className="chart-explanation-overlay" onPointerDown={event => { if (event.target === event.currentTarget) dismiss() }}>
      <section ref={panel} id={id} className="chart-explanation-panel" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1}>
        <header className="chart-explanation-header">
          <span className="chart-explanation-icon"><Sparkles size={21} aria-hidden="true" /></span>
          <div className="chart-explanation-title"><p>Chart explanation</p><h2 id={`${id}-title`}>{facts?.title || 'Chart'}</h2></div>
          <button ref={closeButton} type="button" className="chart-explanation-close" aria-label="Close explanation" onClick={dismiss}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="chart-explanation-body">
          {facts?.scope.start && facts.scope.end && <div className="chart-explanation-period">
            <CalendarDays size={16} aria-hidden="true" /><div><span>Selected period</span><p>{new Date(facts.scope.start).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} to {new Date(facts.scope.end).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} <small>(Manila)</small></p>
              {['current', 'forecast', 'scenario'].includes(facts.basis) && <small>{facts.basis === 'current' ? 'Inventory balances are current.' : facts.basis === 'forecast' ? 'Projection history is based on the period end.' : 'Uses current balances and recipes.'}</small>}</div>
          </div>}
          {current?.status === 'loading' ? <div className="chart-explanation-state" role="status">
            <LoaderCircle className="chart-explanation-spinner" size={26} aria-hidden="true" /><h3>Preparing your explanation</h3><p>Verifying chart data and selecting supported findings.</p>
          </div> : current?.status === 'error' ? <div className="chart-explanation-state chart-explanation-error" role="alert">
            <AlertCircle size={26} aria-hidden="true" /><h3>Explanation unavailable</h3><p>{current.message}</p>
            {current.changed && refresh ? <button type="button" className="btn btn-secondary" onClick={refresh}>Refresh Analytics</button>
              : <button type="button" className="btn btn-secondary" disabled={!available} onClick={explain}>Retry explanation</button>}
          </div> : ready ? <>
            <div className="chart-explanation-source"><span className={`badge ${current.data.source === 'template' ? 'badge-warning' : 'badge-success'}`}>{current.data.source === 'template' ? 'Basic summary' : 'AI interpretation'}</span>
              <p>{current.data.source === 'template' ? 'Verified figures with a standard explanation; no AI result was used.' : 'AI selected relevant findings and review actions. Figures are checked against the recorded data.'}</p></div>
            <section className="chart-explanation-findings" aria-labelledby={`${id}-findings`}><h3 id={`${id}-findings`}>Key findings</h3>
              <ol>{current.data.observations.map((row, index) => <li key={row.id}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><p>{row.text}</p></li>)}</ol>
            </section>
            {current.data.actions.length > 0 && <section className="chart-explanation-review" aria-labelledby={`${id}-review`}>
              <h3 id={`${id}-review`}><ClipboardCheck size={17} aria-hidden="true" />Suggested review</h3>{current.data.actions.map(row => <p key={row.id}>{row.text}</p>)}
            </section>}
            <details className="chart-explanation-limitations"><summary>Data basis and limitations</summary><ul>{current.data.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
          </> : <div className="chart-explanation-state"><Sparkles size={26} aria-hidden="true" /><h3>{available ? 'The chart selection changed' : 'Waiting for chart data'}</h3><p>{available ? 'Request an explanation for the current view.' : 'Chart data is loading or unavailable.'}</p>
            <button type="button" className="btn btn-secondary" disabled={!available} onClick={explain}>Explain this view</button></div>}
        </div>
        <footer className="chart-explanation-footer"><button type="button" className="btn btn-secondary" onClick={dismiss}>Done</button></footer>
      </section>
    </div>, document.body)}
  </>
}
