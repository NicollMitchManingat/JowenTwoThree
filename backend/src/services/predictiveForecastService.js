const { DAY_MS, calendarStart, dayStart, dayKey, readAll } = require('./analyticsReadService')
const { buildSalesForecast } = require('./salesForecastMath')
const { netDailySales } = require('./insightsService')
const config = require('./insightsConfig')

async function readSalesHistory(client, from, until, signal) {
  const supabase = client !== undefined ? client : require('../config/supabaseClient').supabase
  if (!supabase) throw Object.assign(new Error('Sales forecast data is unavailable. Please retry.'), { statusCode: 503 })
  const read = (table, columns) => readAll((start, stop) => {
    const query = supabase.from(table).select(columns).gte('created_at', from.toISOString()).lt('created_at', until.toISOString())
      .order('created_at').order('id').range(start, stop)
    return signal && query.abortSignal ? query.abortSignal(signal) : query
  }, { label: 'Sales forecast' })
  const [transactions, refunds] = await Promise.all([
    read('transactions', 'id,created_at,total,status'),
    read('refunds', 'id,transaction_id,created_at,refund_amount'),
  ])
  const inWindow = rows => rows.filter(row => {
    const time = typeof row?.created_at === 'string' ? new Date(row.created_at).getTime() : NaN
    if (!Number.isFinite(time)) throw Object.assign(new Error('Sales history contains an invalid timestamp.'), { statusCode: 503 })
    return time >= from.getTime() && time < until.getTime()
  })
  return { transactions: inWindow(transactions), refunds: inWindow(refunds) }
}

async function getSalesForecast({ asOf, client, now = new Date(), signal } = {}) {
  const today = dayStart(now)
  if (!today) throw new Error('Forecast clock is unavailable.')
  const requested = asOf === undefined ? today : calendarStart(asOf)
  if (!requested) throw Object.assign(new Error('Use a valid asOf date in YYYY-MM-DD format.'), { statusCode: 400 })
  // Historical dates are complete. Today/future dates use yesterday.
  const end = requested < today ? requested : new Date(today.getTime() - DAY_MS)
  const from = new Date(end.getTime() - (config.TRAILING_DAYS - 1) * DAY_MS)
  const until = new Date(end.getTime() + DAY_MS)
  const { transactions, refunds } = await readSalesHistory(client, from, until, signal)
  return {
    ...buildSalesForecast(netDailySales(transactions, refunds), dayKey(end), config),
    generatedAt: new Date(now).toISOString(),
    requestedAsOf: asOf || dayKey(today), historical: requested < today,
    dataQuality: { complete: true, timeZone: 'Asia/Manila', recordingCoverage: 'unknown',
      currentDayExcluded: true, historicalStatusSnapshots: false, revenueBasis: 'Dashboard daily revenue after refunds' },
  }
}

module.exports = { getSalesForecast, readSalesHistory }
