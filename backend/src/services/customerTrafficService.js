const { DAY_MS, dayStart, calendarStart, dayKey, hourOf, readAll } = require('./analyticsReadService')
const { customerCount, addCounts, buildTrafficForecast } = require('./trafficForecastMath')
const config = require('./insightsConfig')

async function readTraffic(client, from, until, signal) {
  const supabase = client !== undefined ? client : require('../config/supabaseClient').supabase
  if (!supabase) throw Object.assign(new Error('Customer traffic is unavailable. Please retry.'), { statusCode: 503 })
  const rows = await readAll((start, stop) => {
    const query = supabase.from('customer_traffic').select('id,created_at,number_of_customer:number_of_customer::text')
      .gte('created_at', from.toISOString()).lt('created_at', until.toISOString()).order('created_at').order('id').range(start, stop)
    return signal && query.abortSignal ? query.abortSignal(signal) : query
  }, { label: 'Customer traffic', maxRows: 100000 })
  return rows.filter(row => {
    if (!row || typeof row.created_at !== 'string') throw Object.assign(new Error('Customer traffic contains an invalid timestamp.'), { statusCode: 503 })
    const time = new Date(row.created_at).getTime()
    if (!Number.isFinite(time)) throw Object.assign(new Error('Customer traffic contains an invalid timestamp.'), { statusCode: 503 })
    return time >= from.getTime() && time < until.getTime()
  })
}
async function getCustomerTrafficData({ start, end, client, now = new Date() } = {}) {
  const from = start ? new Date(start) : dayStart(now), until = end ? new Date(end) : new Date(now)
  if (!from || !Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime()) || from >= until)
    throw Object.assign(new Error('Use a valid start and end time.'), { statusCode: 400 })
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, customers: 0 }))
  for (const row of await readTraffic(client, from, until)) {
    const hour = hourOf(row.created_at)
    hourly[hour].customers = addCounts(hourly[hour].customers, customerCount(row.number_of_customer))
  }
  return hourly
}
async function getTrafficForecast({ asOf, client, now = new Date(), signal } = {}) {
  const today = dayStart(now), requested = asOf === undefined ? today : calendarStart(asOf)
  if (!today || !requested) throw Object.assign(new Error('Use a valid asOf date in YYYY-MM-DD format.'), { statusCode: 400 })
  const through = requested < today ? requested : new Date(today.getTime() - DAY_MS)
  const from = new Date(through.getTime() - (config.TRAILING_DAYS - 1) * DAY_MS), until = new Date(through.getTime() + DAY_MS)
  return { ...buildTrafficForecast(await readTraffic(client, from, until, signal), dayKey(through), config),
    generatedAt: new Date(now).toISOString(), requestedAsOf: asOf || dayKey(today), historical: requested < today,
    dataQuality: { complete: true, timeZone: 'Asia/Manila', currentDayExcluded: true, recordingCoverage: 'unknown', source: 'customer_traffic' } }
}
module.exports = { getCustomerTrafficData, getTrafficForecast, readTraffic }
