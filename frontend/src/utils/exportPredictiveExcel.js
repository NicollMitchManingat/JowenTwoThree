import { addReportSheet, downloadReportWorkbook, REPORT_MONEY, REPORT_DECIMAL } from './reportWorkbook'
import { reportDateRange, reportFilename } from './reportDateRange'
import { manilaDay } from './analyticsTime'

const col = (header, key, width = 22, extra = {}) => ({ header, key, width, ...extra })
const period = row => row.through && row.through !== row.date ? `${row.date} to ${row.through}` : row.date
const label = value => value === 'insufficient_training' ? 'Insufficient history' : String(value || 'Not recorded').replace(/_/g, ' ')
const missing = row => row.status === 'no_recorded_usage' ? 'No recorded usage' : row.status === 'no_recipe' ? 'No recipe link' : label(row.status || 'Insufficient history')
export const predictiveValue = row => row.value ?? (['Advisory', 'Limitation'].includes(row.basis) ? 'See details' : missing(row))
const amount = predictiveValue

export function buildPredictiveWorkbook(ExcelJS, data) {
  if (!data || data.dataQuality?.complete !== true || !Array.isArray(data.rows)) throw new Error('Predictive report is unavailable or incomplete.')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Jowen's Kitchen & Cafe"
  workbook.created = new Date(data.generatedAt)
  const range = reportDateRange({ from: manilaDay(data.period.start), to: manilaDay(data.period.end) })
  const add = (name, columns, rows, note) => addReportSheet(workbook, { name, range, columns, rows, note })
  const rows = data.rows
  add('Summary', [col('Measure', 'metric', 38), col('Value', 'value', 28), col('Basis', 'basis', 64)], [
    { metric: 'Generated at', value: new Date(data.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }), basis: 'Asia/Manila' },
    { metric: 'Seven-day sales forecast (PHP)', value: data.summary.salesTotal ?? 'Insufficient history', basis: label(data.summary.salesStatus), formats: { value: REPORT_MONEY } },
    { metric: 'Seven-day customer forecast', value: data.summary.trafficTotal ?? 'Insufficient history', basis: label(data.summary.trafficStatus) },
    { metric: 'Current inventory items', value: data.summary.inventoryItems, basis: 'Current balances; not historical balances' },
    { metric: 'Sales days scored retrospectively', value: data.summary.salesScoredDays, basis: 'Historical check; not proof of future accuracy' },
    { metric: 'Traffic days scored retrospectively', value: data.summary.trafficScoredDays, basis: 'Historical check; not proof of future accuracy' },
  ], 'Recorded history, calculated forecasts and current-recipe scenarios are kept separate. Forecasts are not included in recorded totals.')

  for (const [section, prefix, valueLabel, format] of [['Sales', 'Sales', 'Net revenue (PHP)', REPORT_MONEY], ['Customer Traffic', 'Traffic', 'Recorded customers', '#,##0']]) {
    const history = rows.filter(row => row.section === section && row.basis === 'Recorded' && row.metric.startsWith('Daily'))
    const forecasts = rows.filter(row => row.section === section && row.basis === 'Prediction' && row.metric !== 'Hourly customer forecast')
    add(`${prefix} History`, [col('Date', 'date', 16), col(valueLabel, 'value', 26, { format }), col('Coverage', 'status', 26)],
      history.map(row => ({ date: row.date, value: amount(row), status: row.status })),
      `History window: ${history[0]?.date || 'No records'} to ${history.at(-1)?.date || 'No records'}. A day without a supported recording is Unknown, not a confirmed zero.`)
    add(`${prefix} Forecast`, [col('Measure', 'metric', 28), col('Forecast period', 'period', 27), col(prefix === 'Sales' ? 'Estimated amount (PHP)' : 'Estimated customers', 'value', 25, { format }), col('Status', 'status', 23), col('Recorded history days', 'days', 21)],
      forecasts.map(row => ({ metric: row.metric, period: period(row), value: amount(row), status: row.status, days: row.observedDays })),
      forecasts.length ? `History: ${forecasts[0].trainingFrom} to ${forecasts[0].trainingThrough}; ${forecasts[0].method}. The seven-day total summarizes the daily rows; do not add it again.` : 'No forecast is supported by this report.')
  }
  add('Hourly Traffic', [col('Forecast date', 'date', 16), col('Hour (Manila)', 'hour', 19), col('Estimated customers', 'value', 24), col('Matching recorded days', 'days', 23), col('Status', 'status', 28)],
    rows.filter(row => row.metric === 'Hourly customer forecast').map(row => ({ date: row.date, hour: `${String(row.hour).padStart(2, '0')}:00`, value: amount(row), days: row.observedDays, status: row.status })),
    'Unknown hours are not confirmed closed or quiet. Hourly estimates can have different recording coverage from the daily forecast.')

  const grouped = new Map()
  rows.filter(row => row.section === 'Inventory' && ['Current balance', 'Scenario'].includes(row.basis) && row.item).forEach(row => {
    const key = JSON.stringify([row.inventoryId || row.item, row.unitVersion])
    if (!grouped.has(key)) grouped.set(key, { item: row.item, status: row.status, action: row.note })
    const item = grouped.get(key)
    const field = { 'Current quantity': 'quantity', 'Daily ingredient usage': 'daily', 'Seven-day ingredient requirement': 'week', 'Days of stock cover': 'cover', 'Seven-day shortage': 'shortage' }[row.metric]
    if (field) item[field] = amount(row)
    if (row.basis === 'Current balance') item.unit = row.unit
    else { item.status = label(row.status); item.action = row.note?.split('. ')[0]; item.history = `${row.trainingFrom} to ${row.trainingThrough}` }
  })
  add('Inventory Planning', [col('Ingredient', 'item', 28), col('Unit', 'unit', 10), col('Current quantity', 'quantity', 20, { decimal: true, format: REPORT_DECIMAL }), col('Daily recipe-based usage', 'daily', 21, { decimal: true, format: REPORT_DECIMAL }), col('Seven-day requirement', 'week', 21, { decimal: true, format: REPORT_DECIMAL }), col('Days of stock cover', 'cover', 21, { decimal: true, format: REPORT_DECIMAL }), col('Seven-day shortage', 'shortage', 21, { decimal: true, format: REPORT_DECIMAL }), col('Status', 'status', 22), col('Action', 'action', 35)], [...grouped.values()],
    `Usage data: ${[...grouped.values()][0]?.history || 'Not supplied'}. Current linked recipes only, not historical stock consumption. Undefined cover is identified rather than shown as zero or infinity.`)

  const waste = new Map()
  rows.filter(row => row.metric === 'Recorded wastage quantity' || row.metric === 'Recorded wastage entries').forEach(row => {
    const key = JSON.stringify([row.inventoryId || row.item, row.unitVersion, row.unit === 'entries' ? '' : row.unit])
    // The adjacent quantity/entry rows share ingredient/version; retain distinct recorded unit groups.
    if (row.metric === 'Recorded wastage quantity') waste.set(key, { item: row.item, unit: row.unit || 'Unrecorded unit', version: row.unitVersion ?? 'Unrecorded', quantity: amount(row), status: row.status, notes: row.note })
    else {
      const group = [...waste.values()].reverse().find(item => item.item === row.item && String(item.version) === String(row.unitVersion ?? 'Unrecorded'))
      if (group) group.entries = row.value
    }
  })
  add('Recorded Wastage', [col('Ingredient', 'item', 28), col('Unit', 'unit', 16), col('Unit version', 'version', 16), col('Quantity', 'quantity', 23, { decimal: true, format: REPORT_DECIMAL }), col('Entries', 'entries', 12), col('Status', 'status', 23), col('Recorded context', 'notes', 60)], [...waste.values()],
    'Only recorded losses in the selected period. No qualifying entries does not establish zero physical wastage; unrecorded units are never guessed.')
  add('Historical Checks', [col('Aspect', 'section', 21), col('Measure', 'metric', 33), col('Evaluation period', 'period', 27), col('Value', 'value', 24, { format: REPORT_DECIMAL }), col('Unit', 'unit', 14), col('Scored days', 'days', 16), col('Status', 'status', 26)],
    rows.filter(row => row.basis === 'Historical check').map(row => ({ section: row.section, metric: row.metric, period: period(row), value: amount(row), unit: row.unit, days: row.observedDays, status: label(row.status) })),
    'Retrospective comparisons using current records, not stored past forecasts. WAPE is a percentage error, not an accuracy or confidence percentage.')
  const quality = data.dataQuality.inventory || {}
  add('Methods and Coverage', [col('Aspect', 'section', 22), col('Topic', 'metric', 37), col('Details', 'note', 105)], [
    ...data.notes.map(note => ({ section: 'Report', metric: 'Method / coverage', note })),
    ...rows.filter(row => row.basis === 'Advisory' || (row.basis === 'Limitation' && row.section !== 'Report')).map(row => ({ section: row.section, metric: row.metric, note: row.note || row.status })),
    { section: 'Inventory', metric: 'Sales without current recipe links', note: quality.unlinkedProductLines == null ? 'Coverage count not supplied by this report.' : `${quality.unlinkedProductLines} sale lines have no current recipe link; usage figures cover linked products only.` },
  ], 'Reasons for unavailable calculations remain explicit. No missing quantity, date, voucher identity or recording is invented.')
  return workbook
}

export async function downloadPredictiveExcel(data, signal) {
  const imported = await import('exceljs'), ExcelJS = imported.default ?? imported
  return downloadReportWorkbook(buildPredictiveWorkbook(ExcelJS, data), reportFilename('predictive-report', { from: manilaDay(data.period.start), to: manilaDay(data.period.end) }), signal)
}
