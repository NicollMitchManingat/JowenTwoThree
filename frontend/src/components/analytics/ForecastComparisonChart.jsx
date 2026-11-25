import { useId, useState } from 'react'
import SalesTrendChart from './SalesTrendChart'

export default function ForecastComparisonChart({ points = [], unit = 'PHP' }) {
  const id = useId(), [view, setView] = useState('comparison')
  if (!points.length) return <p className="text-sm text-muted">Daily forecast comparisons are unavailable for this selection.</p>
  const lookup = new Map(points.map(row => [row.date, row])), dates = [...lookup.keys()].sort()
  const first = Date.parse(dates[0] + 'T12:00:00Z'), length = Math.round((Date.parse(dates.at(-1) + 'T12:00:00Z') - first) / 86400000) + 1
  if (length < 1 || length > 28) return <p className="text-sm text-muted">Daily comparison dates need review.</p>
  const labels = Array.from({ length }, (_, i) => new Date(first + i * 86400000).toISOString().slice(0, 10))
  const rows = labels.map(date => lookup.get(date))
  const data = { labels, datasets: view === 'deviation' ? [
    { label: 'Forecast minus recorded actual', data: rows.map(row => row?.deviation ?? null), borderColor: '#d97706', backgroundColor: '#d97706', fill: false, spanGaps: false, tension: 0, pointRadius: 2 },
    { label: 'Zero deviation', data: rows.map(() => 0), borderColor: '#94a3b8', borderDash: [4, 4], fill: false, pointRadius: 0 },
  ] : [
    { label: 'Recorded actual', data: rows.map(row => row?.actual ?? null), borderColor: '#16a34a', backgroundColor: '#16a34a', fill: false, spanGaps: false, tension: 0, pointRadius: 2 },
    { label: 'Historical forecast', data: rows.map(row => row?.predicted ?? null), borderColor: '#2563eb', backgroundColor: '#2563eb', borderDash: [5, 4], fill: false, spanGaps: false, tension: 0, pointRadius: 2 },
  ] }
  return <div className="forecast-comparison">
    <div className="forecast-comparison-control"><label htmlFor={id}>Comparison view</label><select id={id} className="form-input" value={view} onChange={event => setView(event.target.value)}>
      <option value="comparison">Actual vs forecast</option><option value="deviation">Forecast deviation</option></select></div>
    <div className="analytics-forecast-chart"><SalesTrendChart data={data} showSummary={false} showLegend allowZeroValues
      valueType={unit === 'PHP' ? 'currency' : unit === 'customers' && view === 'comparison' ? 'count' : 'quantity'} valueUnit={unit === 'PHP' ? '' : unit} /></div>
    <p className="text-sm text-muted">Deviation = forecast minus recorded actual. Positive values mean overestimation; negative values mean underestimation. Gaps between scored periods are not confirmed zero activity.</p>
  </div>
}
