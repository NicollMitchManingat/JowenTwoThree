import { Bar } from 'react-chartjs-2'
import { ChartFactsProvider } from './ChartFactsContext'
import PaymentMixChart from './PaymentMixChart'
import VoucherEffectivenessChart from './VoucherEffectivenessChart'
import RefundInsights from './RefundInsights'
import SalesTrendChart from './SalesTrendChart'
import StockMovementChart from './StockMovementChart'
import CustomerTrafficHeatmap, { formatHour } from './CustomerTrafficHeatmap'
import { compareStock, formatStock } from '../../utils/formatStock'

const value = entry => entry && typeof entry === 'object' ? entry.value : entry
const quantity = entry => {
  if (entry == null) return 'Not available'
  const text = formatStock(entry, { maximumFractionDigits: 2 })
  return text === '0' && compareStock(entry, 0) > 0 ? '<0.01' : text
}

function DataTable({ columns, rows, title }) {
  const weights = columns.map(([label]) => ['Item', 'Review', 'Details'].includes(label) ? 2 : 1)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return <table className="chart-focus-table" aria-label={title}>
    <colgroup>{weights.map((weight, index) => <col key={index} style={{ width: `${weight / total * 100}%` }} />)}</colgroup>
    <thead><tr>{columns.map(([label]) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map(([label, read]) => <td key={label}>{read(row)}</td>)}</tr>)}</tbody>
  </table>
}

function Preview({ facts }) {
  const { chartId, rows, series, metrics, view } = facts
  if (!['ready', 'empty', 'insufficient_history'].includes(facts.status)) return <p className="text-muted">Waiting for the current chart data.</p>
  if (series.length) {
    const data = { labels: series[0].points.map(point => point.label || point.key), datasets: series.map(entry => ({
      label: entry.label || (entry.basis === 'forecast' ? 'Forecast' : 'Recorded'),
      data: entry.points.map(point => point.value),
      borderColor: entry.basis === 'forecast' ? '#d4a373' : '#16a34a',
      backgroundColor: entry.basis === 'forecast' ? '#d4a373' : '#16a34a',
      borderDash: entry.basis === 'forecast' ? [6, 4] : undefined, fill: false, spanGaps: false,
    })) }
    return <><div className="chart-focus-series"><SalesTrendChart data={data} variant={view.variant || (chartId === 'weekday-pattern' ? 'bar' : 'line')}
      showSummary={false} showLegend={series.length > 1} allowZeroValues valueType={series[0].unit === 'customers' ? 'count' : 'currency'} /></div>
      {chartId === 'traffic-forecast' && rows.length > 0 && <div className="chart-focus-hourly"><h3>Hourly estimates: {view.selectedDay}</h3><div className="chart-focus-hours">{rows.map(row => <div key={row.hour}>
        <strong>{formatHour(row.hour)}</strong><span>{row.predictedCustomers ?? 'Unavailable'}</span><small>{row.samples} recorded samples</small>
      </div>)}</div></div>}</>
  }
  if (chartId === 'payment-mix') return <PaymentMixChart mix={rows.map(row => ({ method: row.method, amount: value(row.amount), orders: value(row.transactions) }))} />
  if (chartId === 'voucher-effectiveness') return <VoucherEffectivenessChart stats={rows.map(row => ({ key: row.key, name: row.name, pesos: value(row.discounted), redemptions: value(row.redemptions) }))} />
  if (chartId === 'refunds') return metrics.count ? <RefundInsights summary={{ count: value(metrics.count), amount: value(metrics.amount), rate: value(metrics.rate),
    byReason: rows.map(row => ({ reason: row.reason, count: value(row.count), amount: value(row.amount) })) }} /> : <p>Chart figures are unavailable.</p>
  if (chartId === 'top-selling') return <StockMovementChart data={rows.map(row => ({ name: row.name, sold: value(row.sold) }))} />
  if (chartId === 'traffic-heatmap') return rows.length ? <CustomerTrafficHeatmap data={rows} startDate={facts.scope.start} endDate={facts.scope.end} /> : <p>No traffic recorded for this selection.</p>
  if (chartId === 'traffic-comparison') return <Bar data={{ labels: rows.map(row => formatHour(row.hour)), datasets: [
    { label: 'Recorded customers', data: rows.map(row => value(row.recordedCustomers)), backgroundColor: '#3b82f6' },
    { label: 'Transactions', data: rows.map(row => value(row.transactions)), backgroundColor: '#16a34a' },
  ] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxRotation: 45, maxTicksLimit: 8 } } } }} />
  if (!rows.length) return <p className="text-muted">No entries displayed for this selection.</p>
  const columns = chartId === 'low-stock' ? [
    ['Item', row => row.name], ['Quantity', row => quantity(row.quantity)], ['Unit', row => row.unit || 'Unrecorded'],
    ['Threshold', row => quantity(row.threshold)], ['Status', row => row.status === 'out' ? 'Out of stock' : 'Low stock'],
  ] : chartId === 'recorded-wastage' ? [
    ['Item', row => row.name], ['Unit', row => row.unit || 'Unrecorded'],
    ['Quantity', row => row.unit === null ? (row.recordedQuantities || []).map(quantity).join(', ') + ' (separate entries)' : quantity(row.quantity)],
    ['Entries', row => row.entries], ['Details', row => `${row.reasons.join(', ')}${row.unitVersion == null ? '; unit unrecorded' : `; unit version ${row.unitVersion}`}`],
  ] : chartId === 'inventory-planning' ? [
    ['Item', row => row.name], ['Quantity', row => quantity(row.quantity)], ['Unit', row => row.unit || 'Unrecorded'],
    ['Daily usage', row => quantity(row.dailyUsage)], ['Days of cover', row => quantity(row.daysCover)],
    ['7-day usage', row => quantity(row.sevenDayUsage)], ['Shortage', row => quantity(row.shortage)], ['Review', row => row.recommendation],
  ] : null
  return columns ? <DataTable title={facts.title} columns={columns} rows={rows} /> : <p>Chart preview unavailable.</p>
}

// Reuse renderers with the already displayed aggregate values. The isolated
// registry prevents preview publishers from replacing the dashboard's facts.
// No preview reads the API or requests a separate explanation.
export default function ChartFocusPreview({ facts }) {
  const table = ['low-stock', 'recorded-wastage', 'inventory-planning'].includes(facts?.chartId)
  return <section className={`chart-focus-pane${table ? ' chart-focus-pane--table' : ''}`} aria-label="Selected chart">
    <div className="chart-focus-heading"><h3>Selected chart</h3><p>Same values and selection as the dashboard.</p>
      {facts?.view.page != null && <small>Displayed page {facts.view.page + 1}</small>}
      {facts?.status === 'insufficient_history' && <small>Daily forecast unavailable: insufficient recorded history.</small>}
    </div>
    <div className="chart-focus-scroll"><div className={table ? 'chart-focus-data' : 'chart-focus-plot'}>
      {facts ? <ChartFactsProvider scope={facts.scope}><Preview facts={facts} /></ChartFactsProvider> : <p>Waiting for the current chart data.</p>}
    </div></div>
  </section>
}
