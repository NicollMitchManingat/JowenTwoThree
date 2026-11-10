const { DAY_MS, calendarStart, dayKey } = require('./analyticsReadService')

// Shared by the Sales chart and AI Insights. No missing day is filled with zero.
function buildSalesForecast(daily, through, cfg = {}) {
  const end = calendarStart(through)
  if (!end) throw Object.assign(new Error('Invalid forecast date.'), { statusCode: 400 })
  const windowDays = cfg.TRAILING_DAYS || 28
  const horizon = cfg.FORECAST_DAYS || 7
  const occurrences = cfg.SAME_WEEKDAY_OCCURRENCES || 4
  const minimum = cfg.FORECAST_MIN_WEEKDAY_SAMPLES || 2
  const first = new Date(end.getTime() - (windowDays - 1) * DAY_MS)
  const byWeekday = Array.from({ length: 7 }, () => [])
  const history = Array.from({ length: windowDays }, (_, index) => {
    const date = dayKey(new Date(first.getTime() + index * DAY_MS))
    const value = daily?.[date]
    const revenue = value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
    if (revenue !== null) byWeekday[new Date(date + 'T12:00:00Z').getUTCDay()].push(revenue)
    return { date, revenue }
  })
  const observedDays = history.filter(row => row.revenue !== null).length
  const samples = byWeekday.map(values => Math.min(occurrences, values.length))
  const ready = samples.every(count => count >= minimum)
  const forecast = ready ? Array.from({ length: horizon }, (_, index) => {
    const date = dayKey(new Date(end.getTime() + (index + 1) * DAY_MS))
    const values = byWeekday[new Date(date + 'T12:00:00Z').getUTCDay()].slice(-occurrences)
    return { date, predictedRevenue: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) }
  }) : []
  return {
    status: ready ? 'ready' : 'insufficient_history',
    method: { id: 'same_weekday_average', label: 'Same-weekday moving average', windowDays,
      occurrences, minimumSamplesPerWeekday: minimum, horizonDays: horizon },
    training: { from: history[0].date, through, observedDays, missingDays: windowDays - observedDays,
      samplesByWeekday: samples },
    history, forecast,
    total: ready ? forecast.reduce((sum, row) => sum + row.predictedRevenue, 0) : null,
    notice: ready
      ? 'Estimate based on recorded days only. Missing days are unknown. Forecast accuracy has not yet been evaluated.'
      : `Insufficient history: record at least ${minimum} days for each weekday within the last ${windowDays} complete days. Missing days are not treated as zero sales.`,
  }
}

module.exports = { buildSalesForecast }
