const { DAY_MS, dayKey, dayStart, calendarStart } = require('./analyticsReadService')
const { readSalesHistory } = require('./predictiveForecastService')
const { readTraffic } = require('./customerTrafficService')
const { buildSalesForecast } = require('./salesForecastMath')
const { buildTrafficForecast } = require('./trafficForecastMath')
const { buildForecastValidation, validationWindow } = require('./forecastValidationService')
const inventoryAnalytics = require('./inventoryAnalyticsService')
const { netDailySales } = require('./insightsService')
const config = require('./insightsConfig')
const MAX_REPORT_ROWS = 10000
const tooLarge = () => Object.assign(new Error('Predictive report exceeds the safe export limit. Review reporting data volume before retrying.'), { statusCode: 503 })

const HEADERS = ['section', 'basis', 'metric', 'date', 'through', 'item', 'hour', 'unit', 'unit_version', 'value',
  'status', 'method', 'training_from', 'training_through', 'observed_days', 'horizon_days', 'note']
const KEYS = ['section', 'basis', 'metric', 'date', 'through', 'item', 'hour', 'unit', 'unitVersion', 'value',
  'status', 'method', 'trainingFrom', 'trainingThrough', 'observedDays', 'horizonDays', 'note']
function csvCell(value) {
  let text = value == null ? '' : String(value)
  // Quoting alone does not stop spreadsheet formulas in editable item/unit text.
  let first = 0
  while (first < text.length && (text.charCodeAt(first) <= 32 || /\s/.test(text[first]))) first++
  if (typeof value === 'string' && ('=+@-'.includes(text[first]) || /^[\t\r\n]/.test(text))) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}
function predictiveCsv(rows) {
  return '\ufeff' + [HEADERS, ...rows.map(row => KEYS.map(key => row[key]))].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
function reportRows({ generatedAt, period, sales, traffic, inventory, validation }) {
  const rows = []
  const add = row => {
    if (rows.length >= MAX_REPORT_ROWS) throw tooLarge()
    rows.push({ ...row, value: row.value ?? null })
  }
  add({ section: 'Report', basis: 'Metadata', metric: 'Generated at (Manila reporting zone)', value: generatedAt, status: 'Recorded' })
  add({ section: 'Report', basis: 'Metadata', metric: 'Selected period', date: period.start, through: period.end,
    status: 'Selected', note: 'Selected period controls recorded wastage. Forecasts use complete days anchored to the selected end calendar date; current inventory is not a historical balance.' })
  for (const [section, model, key, predicted, unit] of [
    ['Sales', sales, 'revenue', 'predictedRevenue', 'PHP'], ['Customer Traffic', traffic, 'customers', 'predictedCustomers', 'customers'],
  ]) {
    const meta = { section, unit, method: model.method.label, trainingFrom: model.training.from,
      trainingThrough: model.training.through, observedDays: model.training.observedDays, horizonDays: model.method.horizonDays }
    for (const row of model.history) add({ ...meta, basis: 'Recorded', metric: section === 'Sales' ? 'Daily revenue after refunds' : 'Daily recorded customers',
      date: row.date, value: row[key], status: row[key] === null ? 'Unknown' : 'Recorded',
      method: section === 'Sales' ? 'Dashboard daily revenue after refunds' : 'Recorded customer counts only',
      trainingFrom: null, trainingThrough: null, observedDays: null, horizonDays: null,
      note: 'Current records; gaps are unknown, not confirmed zero activity.' })
    if (!model.forecast.length) add({ ...meta, basis: 'Prediction', metric: 'Next seven days',
      date: dayKey(new Date(calendarStart(model.training.through).getTime() + DAY_MS)),
      through: dayKey(new Date(calendarStart(model.training.through).getTime() + 7 * DAY_MS)),
      status: 'Insufficient history', note: model.notice })
    for (const row of model.forecast) add({ ...meta, basis: 'Prediction', metric: 'Daily forecast', date: row.date,
      value: row[predicted], status: 'Estimated', note: model.notice })
    if (model.total !== null) add({ ...meta, basis: 'Prediction', metric: 'Seven-day forecast total', date: model.forecast[0].date,
      through: model.forecast.at(-1).date, value: model.total, status: 'Estimated', note: 'Excluded from actual revenue/customer totals.' })
    add({ ...meta, basis: 'Limitation', metric: 'Forecast limitations', status: 'Unverified future performance', note: model.notice })
  }
  for (const day of traffic.hourlyForecast) {
    for (const hour of day.hours) add({ section: 'Customer Traffic', basis: 'Prediction', metric: 'Hourly customer forecast', date: day.date,
      hour: hour.hour, unit: 'customers', value: hour.predictedCustomers, status: hour.predictedCustomers === null ? 'Unknown' : 'Estimated',
      method: traffic.method.label, trainingFrom: traffic.training.from, trainingThrough: traffic.training.through,
      observedDays: hour.samples, horizonDays: 7, note: traffic.hourlyNotice })
    add({ section: 'Customer Traffic', basis: 'Advisory', metric: 'Expected peak / lean periods', date: day.date,
      value: null, status: day.staffing.peakHours.length ? 'Conditional advisory' : 'Insufficient distinct hourly evidence',
      note: day.staffing.peakHours.length ? 'Supported peak hours: ' + day.staffing.peakHours.join(', ') + '; lean hours: ' + day.staffing.leanHours.join(', ') +
        ' (24-hour Manila). Review coverage/prep/breaks; staff counts require service-capacity data. Unknown hours are excluded. Hourly/staffing accuracy is unvalidated.'
        : 'No distinct peak/lean claim. Unknown hours are not confirmed quiet; no staff count is inferred.' })
  }
  for (const item of inventory.planning) {
    const meta = { section: 'Inventory', item: item.name, unit: item.unit, unitVersion: item.unitVersion,
      method: 'Current recipes × recorded-day sales rate', trainingFrom: inventory.usageWindow.from,
      trainingThrough: inventory.usageWindow.through, observedDays: inventory.usageWindow.recordedSalesDays, horizonDays: 7 }
    add({ ...meta, basis: 'Current balance', metric: 'Current quantity', value: item.quantity, status: 'Current',
      method: 'Current inventory balance', trainingFrom: null, trainingThrough: null, observedDays: null, horizonDays: null,
      date: dayKey(generatedAt), note: 'Current balance at report read time, not a historical balance. Exact source decimal retained.' })
    for (const [metric, key, unit] of [['Daily ingredient usage', 'dailyUsage', item.unit + '/day'],
      ['Seven-day ingredient requirement', 'sevenDayUsage', item.unit], ['Days of stock cover', 'daysCover', 'days'], ['Seven-day shortage', 'shortage', item.unit]]) {
      add({ ...meta, basis: 'Scenario', metric, unit, value: item[key], status: item.status,
        note: item.recommendation + '. Current-recipe scenario; assumes the recorded-day rate repeats. Missing days are unknown. No future purchases/deliveries included; historical consumption and accuracy are unvalidated.' })
    }
  }
  if (!inventory.planning.length) add({ section: 'Inventory', basis: 'Scenario', metric: 'Ingredient planning', status: 'No active inventory', note: 'No inventory scenarios available.' })
  for (const item of inventory.wastage) {
    const meta = { section: 'Inventory', basis: 'Recorded', item: item.name, unit: item.unit, unitVersion: item.unitVersion,
      date: inventory.period.start, through: inventory.period.end, status: item.unit === null ? 'Unknown unit' : 'Recorded',
      note: [...item.reasons, item.currentUnit ? 'Current unit/version' : 'Earlier or unrecorded unit; not combined with current units', item.active ? 'Active ingredient' : 'Archived ingredient'].join('; ') }
    add({ ...meta, metric: 'Recorded wastage quantity', value: item.quantity })
    add({ ...meta, metric: 'Recorded wastage entries', unit: 'entries', value: item.entries })
  }
  if (!inventory.wastage.length) add({ section: 'Inventory', basis: 'Recorded', metric: 'Recorded wastage', value: null,
    status: 'No recorded losses', date: inventory.period.start, through: inventory.period.end, note: 'No qualifying entries, not proof of zero physical wastage.' })
  for (const check of validation) {
    const section = check.metric === 'sales' ? 'Sales' : 'Customer Traffic', unit = check.metric === 'sales' ? 'PHP' : 'customers'
    const meta = { section, basis: 'Historical check', method: check.method.label, date: check.evaluation.from, through: check.evaluation.through,
      observedDays: check.coverage.scoredDays, horizonDays: 7, status: check.status, note: 'Revised-current-record comparison; not frozen past forecasts or proof of future accuracy.' }
    add({ ...meta, metric: 'Daily forecast MAE', value: check.metrics?.mae, unit })
    add({ ...meta, metric: 'WAPE', value: check.metrics?.wape, unit: '%', note: meta.note + ' Undefined if actual total is zero; not an accuracy/confidence percentage.' })
    for (const [metric, result] of [['Paired model MAE', check.comparison.model], ['Paired last-week benchmark MAE', check.comparison.baseline]])
      add({ ...meta, metric, unit, value: result?.mae, observedDays: check.comparison.days, note: meta.note + ' Both compared on identical complete weeks only.' })
    for (const fold of check.folds) add({ ...meta, metric: 'Weekly holdout daily MAE', date: fold.from, through: fold.through,
      trainingFrom: fold.trainingFrom, trainingThrough: fold.origin, observedDays: fold.observedActualDays,
      value: fold.metrics?.mae, unit, status: fold.status, note: meta.note + ' Recorded training days: ' + fold.trainingObservedDays + '/28.' })
    for (const note of check.limitations) add({ section, basis: 'Limitation', metric: 'Historical check limitation', status: 'Retrospective only', note })
  }
  return rows
}

async function getPredictiveReport({ start, end, client, now = new Date() } = {}) {
  const validTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(new Date(value).getTime())
  if ((start !== undefined && !validTime(start)) || (end !== undefined && !validTime(end))) throw Object.assign(new Error('Provide valid start/end timestamps with a timezone.'), { statusCode: 400 })
  const stop = new Date(Math.min(end ? Date.parse(end) : now.getTime(), now.getTime()))
  const first = start ? new Date(start) : new Date(dayStart(stop).getTime() - 28 * DAY_MS)
  if (!Number.isFinite(stop.getTime()) || !Number.isFinite(first.getTime()) || first > stop) throw Object.assign(new Error('Start must not follow the end of the period.'), { statusCode: 400 })
  const window = validationWindow(dayKey(stop), now), through = dayKey(window.through)
  const [history, trafficRows, inventory] = await Promise.all([
    readSalesHistory(client, window.from, window.until), readTraffic(client, window.from, window.until),
    inventoryAnalytics.getInventoryAnalytics({ start: first.toISOString(), end: stop.toISOString(), client, now }),
  ])
  const trainFrom = new Date(window.through.getTime() - 27 * DAY_MS)
  const training = rows => rows.filter(row => new Date(row.created_at) >= trainFrom && new Date(row.created_at) < window.until)
  const sales = buildSalesForecast(netDailySales(training(history.transactions), training(history.refunds)), through, config)
  const traffic = buildTrafficForecast(trafficRows, through, config)
  const validation = [buildForecastValidation({ metric: 'sales', through, ...history }), buildForecastValidation({ metric: 'traffic', through, trafficRows })]
  const generatedAt = new Date(now).toISOString(), period = { start: first.toISOString(), end: stop.toISOString() }
  const notes = [
    'Recorded results, current balances, predictions, scenarios and retrospective checks are separate data bases. Predictions are never included in actual totals.',
    'Reporting timezone: Asia/Manila. Sales amounts use PHP. No data is replaced with sample rows; missing recording coverage remains unknown.',
    'Forecasts use complete days anchored to the selected end calendar date, independently of the selected period start or session duration. Inventory usage has its own complete-day window shown on each scenario.',
    'Inventory balances are current, even when viewing a historical period. Wastage is recorded history within the selected timestamps; unknown units have entry counts but no guessed quantities.',
    'Inventory scenarios use current recipes and recorded sales days, not exact past consumption. They do not include future receipts; unit mismatches/unmapped sales withhold estimates.',
    'Historical checks use revised current records, not stored issued forecasts. Current refund statuses and later edits can affect historical training. They do not prove future accuracy.',
    'Hourly traffic and staffing advice are unvalidated; unknown hours are not lean periods. No staffing headcount or confidence percentage is inferred.',
    'All sources must finish their bounded reads. These parallel/paginated reads are not one transactional database snapshot; refresh after concurrent edits.',
    'The CSV exports every section from this loaded report. Preview filters do not change its contents. Text cells that could be spreadsheet formulas are escaped.',
  ]
  const rows = reportRows({ generatedAt, period, sales, traffic, inventory, validation })
  for (const note of notes) rows.push({ section: 'Report', basis: 'Limitation', metric: 'Report limitation', value: null, note })
  if (rows.length > MAX_REPORT_ROWS) throw tooLarge()
  return { schemaVersion: 1, generatedAt, period, forecastThrough: through,
    summary: { salesStatus: sales.status, salesTotal: sales.total, trafficStatus: traffic.status, trafficTotal: traffic.total,
      inventoryItems: inventory.planning.length, salesScoredDays: validation[0].coverage.scoredDays, trafficScoredDays: validation[1].coverage.scoredDays },
    dataQuality: { complete: true, timeZone: 'Asia/Manila', recordingCoverage: 'unknown', historicalSnapshots: false }, notes, rows,
    export: { filename: 'predictive-report-' + dayKey(now) + '.csv', contentType: 'text/csv;charset=utf-8', csv: predictiveCsv(rows) } }
}
module.exports = { getPredictiveReport, reportRows, predictiveCsv }
