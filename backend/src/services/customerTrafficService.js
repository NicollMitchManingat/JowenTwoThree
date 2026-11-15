const { DAY_MS, dayStart, calendarStart, dayKey, hourOf, readAll } = require('./analyticsReadService')
const { customerCount, addCounts, buildTrafficForecast } = require('./trafficForecastMath')
const config = require('./insightsConfig')

async function readTraffic(client, from, until, signal, demographics = false) {
  const supabase = client !== undefined ? client : require('../config/supabaseClient').supabase
  if (!supabase) throw Object.assign(new Error('Customer traffic is unavailable. Please retry.'), { statusCode: 503 })
  const rows = await readAll((start, stop) => {
    let query = supabase.from('customer_traffic').select(demographics
      ? 'id:id::text,created_at,number_of_customer:number_of_customer::text,male_count:male_count::text,female_count:female_count::text,unspecified_count:unspecified_count::text'
      : 'id,created_at,number_of_customer:number_of_customer::text')
    if (from) query = query.gte('created_at', from.toISOString())
    if (until) query = query.lt('created_at', until.toISOString())
    query = query.order('created_at').order('id').range(start, stop)
    return signal && query.abortSignal ? query.abortSignal(signal) : query
  }, { label: 'Customer traffic', maxRows: 100000 })
  return rows.filter(row => {
    if (!row || typeof row.created_at !== 'string') throw Object.assign(new Error('Customer traffic contains an invalid timestamp.'), { statusCode: 503 })
    const time = new Date(row.created_at).getTime()
    if (!Number.isFinite(time)) throw Object.assign(new Error('Customer traffic contains an invalid timestamp.'), { statusCode: 503 })
    return (!from || time >= from.getTime()) && (!until || time < until.getTime())
  })
}

async function getTrafficExport({ from, to, client, signal } = {}) {
  const first = from === undefined ? null : calendarStart(from), last = to === undefined ? null : calendarStart(to)
  if ((from !== undefined && !first) || (to !== undefined && !last) || (first && last && first > last)) {
    throw Object.assign(new Error('Choose valid From and To dates in chronological order.'), { statusCode: 400 })
  }
  const rows = await readTraffic(client, first, last ? new Date(last.getTime() + DAY_MS) : null, signal, true)
  const summary = { records: rows.length, customers: 0, male: 0, female: 0, unspecified: 0 }
  const identifiers = new Set()
  const recordings = rows.map(row => {
    const id = String(row.id ?? '')
    if (!/^\d+$/.test(id) || identifiers.has(id)) throw Object.assign(new Error('Customer traffic recordings are incomplete or changed during export. Please retry.'), { statusCode: 503 })
    identifiers.add(id)
    const total = customerCount(row.number_of_customer), male = customerCount(row.male_count), female = customerCount(row.female_count), unspecified = customerCount(row.unspecified_count)
    if (addCounts(addCounts(male, female), unspecified) !== total) {
      throw Object.assign(new Error('Customer traffic counts do not match their demographic totals. Review the recordings.'), { statusCode: 503 })
    }
    summary.customers = addCounts(summary.customers, total); summary.male = addCounts(summary.male, male)
    summary.female = addCounts(summary.female, female); summary.unspecified = addCounts(summary.unspecified, unspecified)
    return { id, created_at: row.created_at, number_of_customer: total, male_count: male, female_count: female, unspecified_count: unspecified }
  })
  const days = recordings.map(row => dayKey(row.created_at)).sort()
  return { rows: recordings, summary, range: { from: from || days[0] || null, to: to || days.at(-1) || null },
    dataQuality: { complete: true, timeZone: 'Asia/Manila', source: 'customer_traffic', recordingCoverage: 'unknown' } }
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
module.exports = { getCustomerTrafficData, getTrafficForecast, readTraffic, getTrafficExport }
