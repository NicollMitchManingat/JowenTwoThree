import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
import { manilaStart, manilaDay } from '../../utils/analyticsTime'
import SalesTrendChart from './SalesTrendChart'
import { formatHour } from './CustomerTrafficHeatmap'

const dateLabel = date => manilaStart(date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })
const count = value => Number(value).toLocaleString('en-PH')
const validCount = value => Number.isSafeInteger(value) && value >= 0
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && manilaDay(manilaStart(value)) === value

export default function TrafficForecastPanel({ asOf }) {
  const [result, setResult] = useState(null), [error, setError] = useState(null)
  const [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [selected, setSelected] = useState('')
  useEffect(() => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000)
    let cancelled = false
    setResult(null); setError(null); setLoading(true); setSelected('')
    async function load() {
      try {
        const response = await apiRequest('/api/customer-traffic/forecast?' + new URLSearchParams(asOf ? { asOf } : {}), { signal: controller.signal })
        const data = response?.data
        if (!data || data.dataQuality?.complete !== true || !['ready', 'insufficient_history'].includes(data.status) ||
          !data.training || !data.method || !Number.isFinite(new Date(data.generatedAt).getTime()) ||
          !Array.isArray(data.history) || !data.history.every(row => validDate(row.date) && (row.customers === null || validCount(row.customers))) ||
          !Array.isArray(data.forecast) || !data.forecast.every(row => validDate(row.date) && validCount(row.predictedCustomers)) ||
          (data.status === 'ready' && (data.forecast.length !== 7 || !validCount(data.total))) ||
          !Array.isArray(data.hourlyForecast) || data.hourlyForecast.length !== 7 || !data.hourlyForecast.every(day =>
            validDate(day.date) && day.hours?.length === 24 && day.hours.every((row, hour) => row.hour === hour && validCount(row.samples) &&
              (row.predictedCustomers === null || validCount(row.predictedCustomers))) && day.staffing &&
            ['peakHours', 'leanHours'].every(key => Array.isArray(day.staffing[key]) && day.staffing[key].every(hour =>
              Number.isInteger(hour) && hour >= 0 && hour < 24 && day.hours[hour].predictedCustomers !== null)))) {
          throw new Error('Traffic forecast data is unavailable or incomplete. Please retry.')
        }
        if (!cancelled) { setResult(data); setSelected(data.hourlyForecast[0].date) }
      } catch (err) {
        if (!cancelled) setError(controller.signal.aborted ? 'Traffic forecast request timed out. Please retry.' : err.message || 'Traffic forecast is unavailable.')
      } finally { clearTimeout(timer); if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [asOf, retry])
  const chartData = useMemo(() => result && ({
    labels: [...result.history, ...result.forecast].map(row => dateLabel(row.date)),
    datasets: [{ label: 'Recorded customers', data: [...result.history.map(row => row.customers), ...result.forecast.map(() => null)],
      borderColor: '#16a34a', backgroundColor: '#16a34a', fill: false, tension: 0, pointRadius: 2, spanGaps: false },
    ...(result.forecast.length ? [{ label: 'Forecast customers', data: [...result.history.map(() => null), ...result.forecast.map(row => row.predictedCustomers)],
      borderColor: '#2563eb', backgroundColor: '#2563eb', borderDash: [6, 4], fill: false, tension: 0, pointRadius: 3, spanGaps: false }] : [])],
  }), [result])
  const day = result?.hourlyForecast.find(row => row.date === selected)
  const hoursLabel = hours => hours.map(formatHour).join(', ')
  return <div className="card analytics-forecast-card" data-testid="traffic-forecast-panel">
    <div className="card-header"><h3 className="m-0">Customer Traffic Forecast</h3>
      {result?.historical && <span className="badge badge-warning">Historical forecast</span>}</div>
    <div className="card-body analytics-forecast-body">
      {loading ? <p role="status">Loading traffic forecast...</p> : error ? <div role="alert"><p>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={() => setRetry(n => n + 1)}>Retry traffic forecast</button></div> : result && <>
        <div className="analytics-forecast-summary">
          {result.status === 'ready' && <p><span className="text-sm text-muted">Forecast customers · next 7 days</span><strong data-testid="traffic-forecast-total">{count(result.total)}</strong></p>}
          <dl><div><dt>Method</dt><dd>{result.method.label} · up to {result.method.occurrences} matching weekdays</dd></div>
            <div><dt>History</dt><dd>{result.training.from} to {result.training.through} · {result.training.observedDays}/{result.method.windowDays} days recorded</dd></div>
            <div><dt>Generated</dt><dd>{new Date(result.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila)</dd></div></dl>
        </div>
        <p className="text-sm text-muted">{result.notice}</p>
        <p className="text-sm text-muted">Based on the period end, using complete Manila days only. Predictions stay separate from actual customer totals. Checkout traffic is included once; transactions are not added again.</p>
        {result.status === 'insufficient_history' && <p role="status" className="font-semibold">Insufficient history for a seven-day daily forecast.</p>}
        <div className="chart-container analytics-forecast-chart"><SalesTrendChart data={chartData} valueType="count" showLegend showSummary={false} allowZeroValues /></div>
        <div className="analytics-traffic-forecast-heading"><h4>Expected hourly traffic</h4>
          <label>Forecast day <select className="form-input" value={selected} onChange={event => setSelected(event.target.value)} aria-label="Forecast day">
            {result.hourlyForecast.map(row => <option key={row.date} value={row.date}>{dateLabel(row.date)}</option>)}
          </select></label></div>
        <p className="text-sm text-muted">{result.hourlyNotice}</p>
        {day && <>
          <div className="analytics-traffic-forecast-grid" aria-label="Hourly customer forecast">
            {day.hours.map(row => <div key={row.hour} data-testid={'forecast-hour-' + row.hour}
              className={'analytics-traffic-forecast-hour ' + (row.predictedCustomers === null ? 'is-unknown' : day.staffing.peakHours.includes(row.hour) ? 'is-peak' : day.staffing.leanHours.includes(row.hour) ? 'is-lean' : '')}>
              <span>{formatHour(row.hour)}</span><strong>{row.predictedCustomers === null ? 'Unknown' : count(row.predictedCustomers)}</strong>
              <small>{row.samples} recorded {row.samples === 1 ? 'day' : 'days'}</small>
            </div>)}
          </div>
          <div className="analytics-traffic-advice" data-testid="traffic-staffing-advice">
            {day.staffing.peakHours.length ? <><p><strong>Expected peak: {hoursLabel(day.staffing.peakHours)}.</strong> Review staffing coverage around these hours.</p>
              <p><strong>Expected lean: {hoursLabel(day.staffing.leanHours)}.</strong> Consider prep and breaks during these supported quieter hours.</p></>
              : <p>No distinct peak or lean period can be identified from sufficiently recorded trading hours for this day.</p>}
            <p className="text-sm text-muted">These are planning advisories, not a staffing roster. Set staff counts using service capacity and expected workload. Unknown hours are not confirmed quiet.</p>
          </div>
        </>}
        {result.historical && <p className="text-sm text-muted">Recomputed from current recordings as of {result.training.through}; later dated recordings are excluded. Past edits can revise this estimate.</p>}
      </>}
    </div>
  </div>
}
