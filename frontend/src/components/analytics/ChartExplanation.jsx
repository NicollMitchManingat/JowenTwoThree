import { useEffect, useId, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { apiRequest } from '../../services/apiClient'
import { chartEvidence } from '../../services/chartFacts'
import { useChartFacts, useRefreshCharts } from './ChartFactsContext'

function validExplanation(data, chartId) {
  return data?.chartId === chartId && ['template', 'gemini', 'groq'].includes(data.source) &&
    Array.isArray(data.observations) && data.observations.length > 0 && data.observations.length <= 3 &&
    Array.isArray(data.actions) && data.actions.length <= 1 &&
    [...data.observations, ...data.actions].every(row => typeof row.id === 'string' && typeof row.text === 'string' && row.text.length <= 2000) &&
    Array.isArray(data.limitations) && data.limitations.every(row => typeof row === 'string' && row.length <= 2000)
}

export default function ChartExplanation({ chartId }) {
  const facts = useChartFacts(chartId), refresh = useRefreshCharts(), id = useId()
  const [open, setOpen] = useState(false), [result, setResult] = useState(null)
  const request = useRef(null)
  const identity = facts?.identity
  const current = result?.identity === identity ? result : null
  const available = facts && ['ready', 'empty', 'insufficient_history'].includes(facts.status)
  useEffect(() => {
    request.current?.abort(); request.current = null
    return () => { request.current?.abort(); request.current = null }
  }, [identity])

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
    if (open) { request.current?.abort(); request.current = null; if (current?.status === 'loading') setResult(null); setOpen(false) }
    else { setOpen(true); if (!current || current.status !== 'ready') void explain() }
  }
  return <>
    <button type="button" className="btn btn-secondary chart-explain-button" aria-expanded={open} aria-controls={id}
      disabled={!available && !open} onClick={toggle} title={available ? 'Explain the verified chart data' : 'Wait for complete chart data'}>
      <Sparkles size={15} aria-hidden="true" />{open ? 'Hide explanation' : 'Explain chart'}
    </button>
    {open && <section id={id} className="chart-explanation-panel" role="region" aria-label={`${facts?.title || 'Chart'} explanation`}>
      {current?.status === 'loading' ? <p role="status">Verifying chart data and preparing the explanation...</p>
        : current?.status === 'error' ? <div role="alert"><p>{current.message}</p>
          {current.changed && refresh ? <button type="button" className="btn btn-secondary" onClick={refresh}>Refresh Analytics</button>
            : <button type="button" className="btn btn-secondary" disabled={!available} onClick={explain}>Retry explanation</button>}</div>
          : current?.status === 'ready' ? <>
            <span className={`badge ${current.data.source === 'template' ? 'badge-warning' : 'badge-success'}`}>{current.data.source === 'template' ? 'Basic summary' : 'AI interpretation'}</span>
            <p className="chart-explanation-provenance">{current.data.source === 'template' ? 'Verified figures with a standard explanation; no AI result was used.' : 'AI selected relevant findings and review actions. Figures are checked against the recorded data.'}</p>
            {facts.scope.start && facts.scope.end && <p className="chart-explanation-provenance">Selected period: {new Date(facts.scope.start).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} to {new Date(facts.scope.end).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })} (Manila). {facts.basis === 'current' ? 'Inventory balances are current.' : facts.basis === 'forecast' ? 'Projection history is based on the period end.' : facts.basis === 'scenario' ? 'Uses current balances and recipes.' : ''}</p>}
            <ul>{current.data.observations.map(row => <li key={row.id}>{row.text}</li>)}</ul>
            {current.data.actions.length > 0 && <><h4>Suggested review</h4><ul>{current.data.actions.map(row => <li key={row.id}>{row.text}</li>)}</ul></>}
            <details><summary>Data basis and limitations</summary><ul>{current.data.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
          </> : <><p>{available ? 'This chart or selection changed. Request an explanation for the current view.' : 'Chart data is loading or unavailable.'}</p>
            <button type="button" className="btn btn-secondary" disabled={!available} onClick={explain}>Explain this view</button></>}
    </section>}
  </>
}
