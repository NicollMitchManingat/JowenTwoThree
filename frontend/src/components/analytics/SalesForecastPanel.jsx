import ForecastValidationPanel from './ForecastValidationPanel'
import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
import { manilaStart } from '../../utils/analyticsTime'
import SalesTrendChart, { formatPeso } from './SalesTrendChart'
import { usePublishChartFacts } from './ChartFactsContext'
import { chartRequestKey, chartSeries, chartMetric } from '../../services/chartFacts'

const dateLabel = date => manilaStart(date).toLocaleDateString('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric',
})

export default function SalesForecastPanel({ asOf }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [sourceKey, setSourceKey] = useState(null)
  const requestKey = chartRequestKey(asOf ?? null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    let cancelled = false
    setResult(null); setError(null); setLoading(true)
    async function load() {
      try {
        const params = new URLSearchParams(asOf ? { asOf } : {})
        const response = await apiRequest(`/api/predictive-forecast?${params}`, { signal: controller.signal })
        const data = response?.data
        if (!data || data.dataQuality?.complete !== true ||
          !['ready', 'insufficient_history'].includes(data.status) ||
          !Array.isArray(data.history) || !Array.isArray(data.forecast) || !data.training || !data.method ||
          !Number.isFinite(new Date(data.generatedAt).getTime()) ||
          !data.history.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && (row.revenue === null || Number.isFinite(row.revenue))) ||
          !data.forecast.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.predictedRevenue) && row.predictedRevenue >= 0) ||
          (data.status === 'ready' && (data.forecast.length !== 7 || !Number.isFinite(data.total)))) {
          throw new Error('Sales forecast data is unavailable or incomplete. Please retry.')
        }
        if (!cancelled) { setResult(data); setSourceKey(requestKey) }
      } catch (err) {
        if (!cancelled) setError(controller.signal.aborted ? 'Sales forecast request timed out. Please retry.' : err.message || 'Sales forecast is unavailable.')
      } finally {
        clearTimeout(timer)
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [asOf, retry])

  const chartData = useMemo(() => {
    if (!result) return null
    const history = result.history, forecast = result.forecast
    return {
      labels: [...history, ...forecast].map(row => dateLabel(row.date)),
      datasets: [
        { label: 'Actual revenue', data: [...history.map(row => row.revenue), ...forecast.map(() => null)],
          borderColor: '#16a34a', backgroundColor: '#16a34a', fill: false, tension: 0,
          pointRadius: 2, spanGaps: false },
        ...(forecast.length ? [{ label: 'Forecast revenue', data: [...history.map(() => null), ...forecast.map(row => row.predictedRevenue)],
          borderColor: '#2563eb', backgroundColor: '#2563eb', borderDash: [6, 4], fill: false,
          tension: 0, pointRadius: 3, spanGaps: false }] : []),
      ],
    }
  }, [result])

  usePublishChartFacts({ chartId: 'sales-forecast', scope: { asOf },
    requestKey: error ? undefined : requestKey, sourceKey,
    status: error ? 'error' : loading || !result ? 'loading' : result.status,
    series: chartSeries(chartData, { keys: result ? [...result.history, ...result.forecast].map(row => row.date) : [], bases: ['recorded', 'forecast'] }),
    metrics: { forecastTotal: chartMetric(result?.total ?? null, 'PHP') },
    coverage: { ...result?.dataQuality, historyWindow: result?.training, method: result?.method, generatedAt: result?.generatedAt },
    limitations: [result?.notice || 'Forecast history is unavailable.', 'Forecast values are estimates and are never added to actual revenue.',
      'Forecasts use their complete-day history window through the selected period end, independently of the selected period start.',
      'Missing history is unknown rather than zero. Historical comparisons do not prove future accuracy.'],
  })

  return <><div className="card analytics-forecast-card" data-testid="sales-forecast-panel">
    <div className="card-header"><h3 className="m-0">Sales Forecast</h3>
      {result?.historical && <span className="badge badge-warning">Historical forecast</span>}
    </div>
    <div className="card-body analytics-forecast-body">
      {loading ? <p role="status">Loading sales forecast...</p> : error ?
        <div role="alert"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={() => setRetry(n => n + 1)}>Retry forecast</button></div>
        : result && <>
          <div className="analytics-forecast-summary">
            {result.status === 'ready' && <p data-testid="sales-forecast-total"><span className="text-sm text-muted">Forecast total · {dateLabel(result.forecast[0].date)}–{dateLabel(result.forecast.at(-1).date)}</span>
              <strong>{formatPeso(result.total)}</strong></p>}
            <dl>
              <div><dt>Method</dt><dd>{result.method.label} · up to {result.method.occurrences} matching weekdays</dd></div>
              <div><dt>History</dt><dd>{result.training.from} to {result.training.through} · {result.training.observedDays}/{result.method.windowDays} days recorded</dd></div>
              <div><dt>Generated</dt><dd>{new Date(result.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila)</dd></div>
            </dl>
          </div>
          <p className="text-sm text-muted" data-testid="sales-forecast-notice">{result.notice}</p>
          <p className="text-sm text-muted">Based on the period end, using complete days only. Predictions are separate from actual revenue totals.</p>
          {result.status === 'insufficient_history' && <p role="status" className="font-semibold">Insufficient history for a seven-day forecast.</p>}
          <div className="chart-container analytics-forecast-chart">
            <SalesTrendChart data={chartData} showLegend showSummary={false} allowZeroValues />
          </div>
          {result.training.missingDays > 0 && <p className="text-sm text-muted">Gaps represent days without recorded revenue data; they are not assumed to be zero.</p>}
          {result.historical && <p className="text-sm text-muted">Historical forecast as of {result.training.through}. Later dated transactions and refunds are excluded. This is recomputed from current records; refund status changes can revise prior revenue.</p>}
        </>}
    </div>
  </div><ForecastValidationPanel metric="sales" asOf={asOf} /></>
}
