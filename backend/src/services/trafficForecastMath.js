const { DAY_MS, calendarStart, dayKey, hourOf } = require('./analyticsReadService')

const unavailable = () => Object.assign(new Error('Customer traffic contains invalid or unsupported counts. Please review the recordings.'), { statusCode: 503 })
function customerCount(value) {
  if (value == null || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw unavailable()
  return Number(value)
}
function addCounts(left, right) {
  const sum = left + right
  if (!Number.isSafeInteger(sum)) throw unavailable()
  return sum
}
function aggregateTraffic(rows) {
  if (!Array.isArray(rows)) throw unavailable()
  const daily = new Map()
  for (const row of rows) {
    if (!row || typeof row.created_at !== 'string') throw unavailable()
    const date = dayKey(row.created_at), hour = hourOf(row.created_at)
    if (!date || !Number.isInteger(hour)) throw unavailable()
    const count = customerCount(row.number_of_customer)
    const entry = daily.get(date) || { customers: 0, hours: new Map() }
    entry.customers = addCounts(entry.customers, count)
    entry.hours.set(hour, addCounts(entry.hours.get(hour) || 0, count))
    daily.set(date, entry)
  }
  return daily
}
// Missing days/hours stay unknown. Multiple recordings in one hour/day are one sample.
function buildTrafficForecast(rows, through, cfg = {}) {
  const end = calendarStart(through)
  if (!end) throw Object.assign(new Error('Invalid traffic forecast date.'), { statusCode: 400 })
  const windowDays = cfg.TRAILING_DAYS || 28, horizon = cfg.FORECAST_DAYS || 7
  const occurrences = cfg.SAME_WEEKDAY_OCCURRENCES || 4, minimum = cfg.FORECAST_MIN_WEEKDAY_SAMPLES || 2
  const first = new Date(end.getTime() - (windowDays - 1) * DAY_MS)
  if (!Array.isArray(rows)) throw unavailable()
  const daily = aggregateTraffic(rows.filter(row => {
    if (!row || typeof row.created_at !== 'string') throw unavailable()
    const time = new Date(row.created_at).getTime()
    if (!Number.isFinite(time)) throw unavailable()
    return time >= first.getTime() && time < end.getTime() + DAY_MS
  }))
  const samples = Array.from({ length: 7 }, () => [])
  const history = Array.from({ length: windowDays }, (_, index) => {
    const date = dayKey(new Date(first.getTime() + index * DAY_MS)), entry = daily.get(date)
    if (entry) samples[new Date(date + 'T12:00:00Z').getUTCDay()].push(entry)
    return { date, customers: entry?.customers ?? null }
  })
  // Integer arithmetic keeps rounded headcounts exact, including large samples.
  const mean = values => {
    const sum = values.reduce((total, value) => total + BigInt(value), 0n), size = BigInt(values.length)
    return customerCount(Number((sum + size / 2n) / size))
  }
  const samplesByWeekday = samples.map(values => Math.min(values.length, occurrences))
  const ready = samplesByWeekday.every(count => count >= minimum)
  const hourlyForecast = Array.from({ length: horizon }, (_, index) => {
    const date = dayKey(new Date(end.getTime() + (index + 1) * DAY_MS))
    const matching = samples[new Date(date + 'T12:00:00Z').getUTCDay()].slice(-occurrences)
    const hours = Array.from({ length: 24 }, (_, hour) => {
      const values = matching.filter(entry => entry.hours.has(hour)).map(entry => entry.hours.get(hour))
      return { hour, samples: values.length, predictedCustomers: values.length >= minimum ? mean(values) : null }
    })
    const supported = hours.filter(row => row.predictedCustomers !== null && row.hour >= (cfg.TRADING_START_HOUR ?? 8) && row.hour <= (cfg.TRADING_END_HOUR ?? 22))
    const max = Math.max(...supported.map(row => row.predictedCustomers)), min = Math.min(...supported.map(row => row.predictedCustomers))
    const distinct = supported.length >= 2 && max > min
    return { date, hours, staffing: { supportedHours: supported.length,
      peakHours: distinct ? supported.filter(row => row.predictedCustomers === max).map(row => row.hour) : [],
      leanHours: distinct ? supported.filter(row => row.predictedCustomers === min).map(row => row.hour) : [] } }
  })
  const forecast = ready ? hourlyForecast.map(({ date }) => {
    const values = samples[new Date(date + 'T12:00:00Z').getUTCDay()].slice(-occurrences).map(entry => entry.customers)
    return { date, predictedCustomers: mean(values) }
  }) : []
  const total = ready ? forecast.reduce((sum, row) => addCounts(sum, row.predictedCustomers), 0) : null
  return { status: ready ? 'ready' : 'insufficient_history',
    method: { id: 'same_weekday_average', label: 'Same-weekday moving average', windowDays, occurrences, minimumSamplesPerWeekday: minimum, horizonDays: horizon },
    training: { from: history[0].date, through, observedDays: history.filter(row => row.customers !== null).length,
      missingDays: history.filter(row => row.customers === null).length, samplesByWeekday },
    history, forecast, hourlyForecast, total,
    notice: ready ? 'Estimates use recorded customer counts only. Recording coverage is unknown; future forecast performance is unverified; see the separate retrospective check.'
      : 'Insufficient daily history: at least ' + minimum + ' recorded days per weekday are required. Missing recordings are unknown, not zero.',
    hourlyNotice: 'Hourly estimates require ' + minimum + ' matching weekdays with recordings in that hour. Daily and hourly estimates use different coverage and may not add up. Peak and lean periods compare supported trading hours only; unknown hours are excluded. Staffing numbers require service-capacity data.' }
}
module.exports = { customerCount, addCounts, aggregateTraffic, buildTrafficForecast }
