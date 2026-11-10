import { useEffect, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
import { manilaDay, manilaStart } from '../../utils/analyticsTime'

const count = value => Number.isInteger(value) && value >= 0
const amount = value => Number.isFinite(value) && value >= 0
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && manilaDay(manilaStart(value)) === value
const validMetrics = value => value === null || (value && count(value.days) && value.days > 0 && value.days <= 28 && amount(value.mae) && (value.wape === null || amount(value.wape)))
function validResult(data, metric) {
  return data?.metric === metric && ['replay_available', 'insufficient_history'].includes(data.status) &&
    data.dataQuality?.complete === true && data.dataQuality?.historicalSnapshots === false && data.dataQuality?.basis === 'current_record_replay' &&
    Number.isFinite(new Date(data.generatedAt).getTime()) && data.method?.trainingDays === 28 && data.method?.horizonDays === 7 &&
    date(data.readWindow?.from) && date(data.readWindow?.through) && date(data.evaluation?.from) && date(data.evaluation?.through) &&
    data.coverage?.attemptedFolds === 4 && count(data.coverage.scoredFolds) && data.coverage.scoredFolds <= 4 &&
    data.coverage.scoredDays === data.coverage.scoredFolds * 7 && count(data.coverage.missingActualDays) && data.coverage.missingActualDays <= 28 &&
    validMetrics(data.metrics) && (data.status === 'insufficient_history' ? data.metrics === null && data.coverage.scoredDays === 0
      : data.metrics?.days === data.coverage.scoredDays && data.coverage.scoredDays > 0) &&
    Array.isArray(data.folds) && data.folds.length === 4 && data.folds.every(fold =>
      date(fold.origin) && date(fold.from) && date(fold.through) && ['scored', 'missing_actuals', 'insufficient_training'].includes(fold.status) &&
      count(fold.observedActualDays) && fold.observedActualDays <= 7 && count(fold.trainingObservedDays) && fold.trainingObservedDays <= 28 &&
      validMetrics(fold.metrics) && (fold.status === 'scored' ? fold.metrics?.days === 7 && fold.observedActualDays === 7 : fold.metrics === null)) &&
    data.folds.filter(fold => fold.status === 'scored').length === data.coverage.scoredFolds &&
    data.folds.reduce((sum, fold) => sum + 7 - fold.observedActualDays, 0) === data.coverage.missingActualDays &&
    data.comparison && count(data.comparison.days) && data.comparison.days % 7 === 0 && data.comparison.days <= data.coverage.scoredDays &&
    validMetrics(data.comparison.model) && validMetrics(data.comparison.baseline) &&
    (data.comparison.days === 0 ? data.comparison.model === null && data.comparison.baseline === null && data.comparison.lowerError === null
      : data.comparison.model?.days === data.comparison.days && data.comparison.baseline?.days === data.comparison.days && ['model', 'baseline', 'tie'].includes(data.comparison.lowerError)) &&
    Array.isArray(data.limitations) && data.limitations.length > 0 && data.limitations.every(value => typeof value === 'string')
}

export default function ForecastValidationPanel({ metric, asOf }) {
  const [enabled, setEnabled] = useState(false), [retry, setRetry] = useState(0)
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000)
    let cancelled = false
    setData(null); setError(null); setLoading(true)
    const endpoint = metric === 'sales' ? '/api/predictive-forecast/validation' : '/api/customer-traffic/validation'
    async function load() {
      try {
        const response = await apiRequest(endpoint + '?' + new URLSearchParams(asOf ? { asOf } : {}), { signal: controller.signal })
        if (!validResult(response?.data, metric)) throw new Error('Historical forecast check is unavailable or incomplete. Please retry.')
        if (!cancelled) setData(response.data)
      } catch (err) {
        if (!cancelled) setError(controller.signal.aborted ? 'Historical forecast check timed out. Please retry.' : err.message || 'Historical forecast check is unavailable.')
      } finally { clearTimeout(timer); if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [enabled, retry, metric, asOf])
  const format = value => metric === 'sales'
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
    : value.toLocaleString('en-PH', { maximumFractionDigits: 2 }) + ' customers'
  const statusLabel = { scored: 'Scored', missing_actuals: 'Missing daily results', insufficient_training: 'Insufficient history' }
  return <div className="card analytics-validation-card" data-testid={metric + '-forecast-validation'}>
    <div className="card-header"><h3 className="m-0">Historical Forecast Check</h3><span className="badge badge-warning">Retrospective only</span></div>
    <div className="card-body analytics-validation-body">
      <p className="text-sm text-muted">Compare daily {metric === 'sales' ? 'sales' : 'customer'} estimates from same-weekday averages with recorded results over four past weeks. Each calculation uses the preceding 28 complete Manila days. These are revised-record checks, not proven future accuracy.</p>
      {!enabled ? <button type="button" className="btn btn-secondary" onClick={() => setEnabled(true)}>Run historical check</button> : <>
        {loading ? <p role="status">Checking historical forecasts...</p> : error ? <div role="alert"><p>{error}</p></div> : data && <>
          <p className="text-sm">Results: {data.evaluation.from} to {data.evaluation.through}. Scored {data.coverage.scoredFolds}/4 complete weeks ({data.coverage.scoredDays} days). Generated {new Date(data.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila).</p>
          {data.status === 'insufficient_history' ? <p role="status" className="font-semibold">Insufficient history for a complete weekly check. No error score is available.</p> : <div className="analytics-validation-metrics">
            <p><span>Average daily error (MAE)</span><strong data-testid="validation-mae">{format(data.metrics.mae)}</strong></p>
            <p><span>Weighted absolute percentage error (WAPE)</span><strong>{data.metrics.wape === null ? 'Not defined (zero recorded total)' : data.metrics.wape.toLocaleString('en-PH', { maximumFractionDigits: 2 }) + '%'}</strong></p>
          </div>}
          {data.comparison.days > 0 ? <p data-testid="validation-comparison">Same weekday last week comparison on the same {data.comparison.days} days: same-weekday average MAE {format(data.comparison.model.mae)}; benchmark MAE {format(data.comparison.baseline.mae)}. {data.comparison.lowerError === 'tie' ? 'Both have the same error.' : data.comparison.lowerError === 'model' ? 'The same-weekday average has lower historical error on these days.' : 'The benchmark has lower historical error on these days.'} This comparison does not change the calculation method.</p>
            : <p className="text-sm text-muted">No comparable complete weeks for the same-weekday-last-week benchmark.</p>}
          <table className="data-table analytics-validation-table" aria-label="Historical forecast checks">
            <colgroup><col style={{ width: '27%' }} /><col style={{ width: '23%' }} /><col style={{ width: '16%' }} /><col style={{ width: '18%' }} /><col style={{ width: '16%' }} /></colgroup>
            <thead><tr><th>Result period</th><th>History through</th><th>Recorded days</th><th>Check</th><th>Daily MAE</th></tr></thead>
            <tbody>{data.folds.map(fold => <tr key={fold.origin}><td>{fold.from} to {fold.through}</td><td>{fold.origin}<small className="text-muted">{fold.trainingObservedDays}/28 days recorded</small></td><td>{fold.observedActualDays}/7</td><td>{statusLabel[fold.status]}</td><td>{fold.metrics ? format(fold.metrics.mae) : 'Not available'}</td></tr>)}</tbody>
          </table>
          <ul className="text-sm text-muted analytics-validation-limits">{data.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul>
        </>}
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => setRetry(value => value + 1)}>{error ? 'Retry historical check' : 'Refresh historical check'}</button>
      </>}
    </div>
  </div>
}
