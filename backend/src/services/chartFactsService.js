// Read-only authoritative counterparts of the displayed chart aggregates.
// Reuse the same portable math/contract modules as React; no browser adapter,
// credentials, raw rows or client-supplied claims are sent to an AI provider.
const access = require('./accessService')
const { readAll, dayKey, hourOf, calendarStart } = require('./analyticsReadService')
const units = require('./inventorySupabaseStore')
const { netDailySales } = require('./insightsService')
const inventoryAnalytics = require('./inventoryAnalyticsService')
const { getSalesForecast } = require('./predictiveForecastService')
const { getTrafficForecast } = require('./customerTrafficService')

let helpers
const loadHelpers = () => helpers ||= Promise.all([
  import('../../../frontend/src/services/salesAnalytics.js'),
  import('../../../frontend/src/services/chartFacts.js'),
  import('../../../frontend/src/utils/formatStock.js'),
])
const fail = (text, status = 400, code) => access.httpError(text, status, code)
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(new Date(value).getTime())
const count = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : 0

async function validateRequest(body) {
  const [, contract] = await loadHelpers()
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['chartId', 'scope', 'view', 'expected'].includes(key)) ||
    !Object.hasOwn(contract.CHART_FACTS, body.chartId)) throw fail('Select a supported analytics chart.')
  const scope = body.scope
  if (!scope || !timestamp(scope.start) || !timestamp(scope.end) || new Date(scope.start) > new Date(scope.end) ||
    !['daily', 'weekly', 'hourly'].includes(scope.detail) || scope.timeZone !== 'Asia/Manila' ||
    Object.keys(scope).some(key => !['start', 'end', 'detail', 'sessionId', 'sessionBasis', 'timeZone', 'asOf', 'refreshKey'].includes(key))) throw fail('Use valid chart filters and a Manila date range.')
  if (scope.sessionId != null && (typeof scope.sessionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(scope.sessionId))) throw fail('Invalid session filter.')
  if (scope.refreshKey !== undefined && (!Number.isSafeInteger(scope.refreshKey) || scope.refreshKey < 0)) throw fail('Invalid refresh state.')
  if (scope.sessionBasis != null && scope.sessionBasis !== 'selected_session_calendar_bounds') throw fail('Invalid session basis.')
  const view = body.view || {}
  if (Array.isArray(view) || Object.keys(view).some(key => !['variant', 'averageLabel', 'page', 'pageSize', 'totalRows', 'selectedDay'].includes(key)) ||
    (view.page !== undefined && (!Number.isInteger(view.page) || view.page < 0 || view.page > 2000)) ||
    (view.pageSize !== undefined && view.pageSize !== 15) ||
    (view.variant !== undefined && !['line', 'bar'].includes(view.variant)) ||
    (view.averageLabel !== undefined && (typeof view.averageLabel !== 'string' || view.averageLabel.length > 40)) ||
    (view.totalRows !== undefined && (!Number.isSafeInteger(view.totalRows) || view.totalRows < 0 || view.totalRows > 100000)) ||
    (view.selectedDay != null && !calendarStart(view.selectedDay))) throw fail('Invalid chart view.')
  try {
    if (body.expected === undefined || contract.canonicalChartValue(body.expected).length > 150000) throw fail('Chart data is missing or too large. Select a shorter period.')
  } catch { throw fail('Chart data is missing or invalid. Select a shorter period.') }
  if (scope.asOf !== undefined && scope.asOf !== dayKey(scope.end)) throw fail('Forecast date must match the selected period end.')
  return { chartId: body.chartId, scope, view, expected: body.expected }
}

async function buildFacts(input, { client, now = new Date(), signal } = {}) {
  const [math, contract, stock] = await loadHelpers()
  const database = client || access.database(), { chartId, scope, view = {} } = input
  const read = (table, columns, dateColumn = 'created_at', range = true) => readAll((start, stop) => {
    let query = database.from(table).select(columns)
    if (range) query = query.gte(dateColumn, scope.start).lte(dateColumn, scope.end)
    query = query.order('id').range(start, stop)
    return signal && query.abortSignal ? query.abortSignal(signal) : query
  }, { label: 'Chart facts', maxRows: table === 'customer_traffic' ? 100000 : 20000 })
  if (scope.sessionId) {
    const session = access.check(await database.from('sessions').select('id,started_at,ended_at').eq('id', scope.sessionId).single())
    const start = session?.started_at && calendarStart(dayKey(session.started_at))
    const end = session?.ended_at && new Date(calendarStart(dayKey(session.ended_at)).getTime() + 86400000 - 1)
    if (!start || !end || start.toISOString() !== new Date(scope.start).toISOString() || end.toISOString() !== new Date(scope.end).toISOString()) throw fail('Session filters changed. Select the session again.', 409, 'CHART_CHANGED')
  }
  let rows = [], series = [], metrics = {}, coverage = { recordingCoverage: 'unknown' }, status = 'ready'
  const metric = contract.chartMetric
  if (['revenue-trend', 'weekday-pattern', 'payment-mix', 'voucher-effectiveness', 'refunds'].includes(chartId)) {
    const [transactions, refunds] = await Promise.all([
      read('transactions', 'id,created_at,subtotal,discount,total,payment_method,discount_type,discount_id,status,customer_count,male_count,female_count,unspecified_count'),
      read('refunds', 'id,refund_amount,created_at,transaction_id'),
    ])
    if (chartId === 'payment-mix') rows = math.paymentMix(transactions).filter(row => String(row.method).trim().toUpperCase() !== 'CARD' && row.amount > 0)
      .map(row => ({ method: row.method, amount: metric(row.amount, 'PHP'), transactions: metric(row.orders, 'transactions') }))
    if (chartId === 'voucher-effectiveness') rows = math.voucherStats(transactions, await read('discounts', '*', 'created_at', false)).filter(row => row.pesos > 0)
      .map(row => ({ key: row.key, name: row.name, discounted: metric(row.pesos, 'PHP'), redemptions: metric(row.redemptions, 'transactions') }))
    if (chartId === 'refunds') {
      const summary = math.refundSummary(transactions, refunds)
      rows = summary.byReason.map(row => ({ reason: row.reason, count: metric(row.count, 'refunds'), amount: metric(row.amount, 'PHP') }))
      metrics = { count: metric(summary.count, 'refunds'), amount: metric(summary.amount, 'PHP'), rate: metric(summary.rate, 'percent') }
    }
    if (['revenue-trend', 'weekday-pattern'].includes(chartId)) {
      const daily = netDailySales(transactions, refunds)
      let points, unit = 'PHP'
      if (chartId === 'weekday-pattern') {
        const buckets = math.aggregateWeekdayPattern(daily)
        points = buckets.some(row => row.avg > 0) ? buckets.map(row => [row.key, Math.round(row.avg)]) : []
        coverage.observationsPerPoint = buckets.map(row => row.days); unit = 'PHP_per_recorded_day'
      } else if (scope.detail === 'hourly') points = Object.entries(math.bucketHourlySales(transactions, refunds)).sort(([a], [b]) => a.localeCompare(b))
      else if (scope.detail === 'weekly') points = math.aggregateWeeklySales(daily).map(row => [row.key, row.total])
      else points = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b))
      series = [{ unit, basis: 'recorded', points: points.map(([key, value]) => ({ key, label: key, value })) }]
    }
  } else if (chartId === 'top-selling') {
    const [items, transactions] = await Promise.all([
      read('transaction_items', 'id,transaction_id,quantity,product_id,products(product_name),transactions!inner(created_at)', 'transactions.created_at'),
      read('transactions', 'id,created_at,cart'),
    ])
    const totals = new Map(), represented = new Set(items.map(row => row.transaction_id))
    const add = (name, quantity) => { const label = String(name || '').trim() || 'Unknown', amount = Number(quantity); if (Number.isFinite(amount) && amount > 0) totals.set(label, (totals.get(label) || 0) + amount) }
    items.forEach(row => add(row.products?.product_name || row.product_id, row.quantity))
    transactions.filter(row => !represented.has(row.id)).forEach(row => (Array.isArray(row.cart) ? row.cart : []).forEach(line => add(line.name || line.product_name, line.qty ?? line.quantity)))
    rows = [...totals].map(([name, sold]) => ({ name, sold: metric(sold, 'product_units') })).sort((a, b) => b.sold.value - a.sold.value).slice(0, 5)
  } else if (chartId === 'low-stock') {
    const inventory = await readAll((a, b) => units.readUnitRows(versioned => {
      const query = database.from('inventory').select(units.inventoryColumns(versioned)).eq('is_active', true).order('id').range(a, b)
      return signal && query.abortSignal ? query.abortSignal(signal) : query
    }), { label: 'Inventory' })
    rows = inventory.filter(row => stock.inventoryStatus(row) !== 'good').sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity)).map(row => ({
      id: row.id, name: row.name, quantity: String(row.stock_quantity), unit: row.unit || null, unitVersion: row.unit_version == null ? null : String(row.unit_version),
      threshold: String(row.low_stock_threshold ?? 5), status: stock.inventoryStatus(row),
    }))
  } else if (['traffic-comparison', 'traffic-heatmap'].includes(chartId)) {
    const traffic = await read('customer_traffic', 'id,created_at,number_of_customer,male_count,female_count,unspecified_count')
    const bins = Array.from({ length: 24 }, (_, hour) => ({ hour, customers: 0, male: 0, female: 0, unspecified: 0, transactions: 0 }))
    for (const row of traffic) {
      const bin = bins[hourOf(row.created_at)]
      if (!bin) continue
      const split = math.customerTotals([{ ...row, customer_count: row.number_of_customer }])
      bin.customers += split.total; bin.male += split.male; bin.female += split.female; bin.unspecified += split.unspecified
    }
    if (chartId === 'traffic-comparison') {
      for (const row of await read('transactions', 'id,created_at')) { const bin = bins[hourOf(row.created_at)]; if (bin) bin.transactions++ }
      rows = bins.map(row => ({ hour: row.hour, recordedCustomers: metric(row.customers, 'customers'), transactions: metric(row.transactions, 'transactions') }))
    } else rows = bins.map(row => {
      const customers = count(row.customers), male = count(row.male), female = count(row.female)
      let unspecified = count(row.unspecified)
      if (male + female + unspecified === 0 && customers > 0) unspecified = customers
      else if (male + female + unspecified !== customers) unspecified = Math.max(0, customers - male - female)
      return { hour: row.hour, customers, male, female, unspecified }
    })
  } else if (['recorded-wastage', 'inventory-planning'].includes(chartId)) {
    const data = await inventoryAnalytics.getInventoryAnalytics({ start: scope.start, end: scope.end, client: database, now, signal })
    const all = chartId === 'recorded-wastage' ? data.wastage : data.planning
    rows = all.slice((view.page || 0) * 15, ((view.page || 0) + 1) * 15); coverage = { ...data.dataQuality, usageWindow: data.usageWindow }
  } else {
    const data = chartId === 'sales-forecast' ? await getSalesForecast({ asOf: scope.asOf || dayKey(scope.end), client: database, now, signal })
      : await getTrafficForecast({ asOf: scope.asOf || dayKey(scope.end), client: database, now, signal })
    status = data.status; coverage = { ...data.dataQuality, historyWindow: data.training, method: data.method }
    const sales = chartId === 'sales-forecast', unit = sales ? 'PHP' : 'customers'
    const points = [...data.history, ...data.forecast]
    series = [{ unit, basis: 'recorded', points: points.map((row, index) => ({ key: row.date, value: index < data.history.length ? row[sales ? 'revenue' : 'customers'] : null })) }]
    if (data.forecast.length) series.push({ unit, basis: 'forecast', points: points.map((row, index) => ({ key: row.date, value: index >= data.history.length ? row[sales ? 'predictedRevenue' : 'predictedCustomers'] : null })) })
    metrics = { forecastTotal: metric(data.total, unit) }
    if (!sales) {
      const day = data.hourlyForecast.find(row => row.date === view.selectedDay)
      if (!day) throw fail('Select an available forecast day.')
      rows = day.hours
    }
  }
  if (status === 'ready' && !chartId.includes('forecast')) {
    const anyValue = series.some(entry => entry.points.some(point => point.value > 0)) ||
      (chartId === 'traffic-heatmap' ? rows.some(row => row.customers > 0) : chartId === 'traffic-comparison'
        ? rows.some(row => row.recordedCustomers.value > 0 || row.transactions.value > 0) : rows.length > 0)
    if (!anyValue) status = 'empty'
  }
  return { chartId, title: contract.CHART_FACTS[chartId][0], basis: contract.CHART_FACTS[chartId][1], scope, view, rows, series, metrics, coverage, status }
}

async function verifyFacts(user, body, options = {}) {
  access.requireModules(user, 'analytics')
  const request = await validateRequest(body), facts = await buildFacts(request, options)
  const [, contract] = await loadHelpers()
  if (contract.canonicalChartValue(contract.chartEvidence(facts)) !== contract.canonicalChartValue(request.expected)) throw fail('Chart data changed. Refresh Analytics and try again.', 409, 'CHART_CHANGED')
  return facts
}
module.exports = { verifyFacts, buildFacts, validateRequest, loadHelpers }
