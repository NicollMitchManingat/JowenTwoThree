import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { usePublishChartFacts } from './ChartFactsContext'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function BreakdownChart({ chartId, rows = [], status = 'ready', scope, coverage, requestKey, sourceKey, limitations = [] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  usePublishChartFacts({ chartId, rows, scope, coverage, requestKey, sourceKey,
    status: status !== 'ready' ? status : total ? 'ready' : 'empty', limitations })
  if (status === 'loading') return <p role="status">Loading chart...</p>
  if (status === 'error') return <p className="text-muted">Chart data is unavailable.</p>
  if (!total) return <p className="text-muted">No recorded items for this chart selection.</p>
  return <div className="analytics-breakdown">
    <div className="analytics-breakdown-plot"><Doughnut data={{ labels: rows.map(row => row.label), datasets: [{ data: rows.map(row => row.count),
      backgroundColor: rows.map(row => row.color), borderWidth: 2, borderColor: '#fff' }] }} options={{ responsive: true, maintainAspectRatio: false,
      cutout: '66%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toLocaleString()} (${(ctx.parsed / total * 100).toFixed(1)}%)` } } } }} /></div>
    <dl className="analytics-breakdown-values">{rows.map(row => <div key={row.key}><dt><span style={{ backgroundColor: row.color }} />{row.label}</dt>
      <dd>{row.count.toLocaleString('en-PH')}<small>{(row.count / total * 100).toFixed(1)}%</small></dd></div>)}
      <div className="analytics-breakdown-total"><dt>Total</dt><dd>{total.toLocaleString('en-PH')}</dd></div></dl>
  </div>
}
