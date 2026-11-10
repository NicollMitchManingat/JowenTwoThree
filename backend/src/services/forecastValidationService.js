const { DAY_MS, calendarStart, dayStart, dayKey } = require('./analyticsReadService')
const { buildSalesForecast } = require('./salesForecastMath')
const { buildTrafficForecast, aggregateTraffic } = require('./trafficForecastMath')
const { readSalesHistory } = require('./predictiveForecastService')
const { readTraffic } = require('./customerTrafficService')
const { netDailySales } = require('./insightsService')
const config = require('./insightsConfig')

const FOLDS = 4
const unavailable = () => Object.assign(new Error('Forecast checks contain invalid or unsupported history. Please review the records.'), { statusCode: 503 })
const round = value => {
  if (!Number.isFinite(value)) throw unavailable()
  return Number(value.toFixed(2))
}
function validationWindow(asOf, now = new Date()) {
  const today = dayStart(now), requested = asOf === undefined ? today : calendarStart(asOf)
  if (!today || !requested) throw Object.assign(new Error('Use a valid asOf date in YYYY-MM-DD format.'), { statusCode: 400 })
  const through = requested < today ? requested : new Date(today.getTime() - DAY_MS)
  const days = config.TRAILING_DAYS + FOLDS * config.FORECAST_DAYS
  return { from: new Date(through.getTime() - (days - 1) * DAY_MS), through,
    until: new Date(through.getTime() + DAY_MS), historical: requested < today,
    requestedAsOf: asOf || dayKey(today) }
}
function inWindow(rows, from, until) {
  if (!Array.isArray(rows)) throw unavailable()
  return rows.filter(row => {
    const time = typeof row?.created_at === 'string' ? new Date(row.created_at).getTime() : NaN
    if (!Number.isFinite(time)) throw unavailable()
    return time >= from.getTime() && time < until.getTime()
  })
}
function metrics(pairs) {
  if (!pairs.length) return null
  const error = pairs.reduce((sum, pair) => sum + Math.abs(pair.predicted - pair.actual), 0)
  const actual = pairs.reduce((sum, pair) => sum + Math.abs(pair.actual), 0)
  if (!Number.isFinite(error) || !Number.isFinite(actual)) throw unavailable()
  return { days: pairs.length, mae: round(error / pairs.length),
    wape: actual > 0 ? round(error / actual * 100) : null }
}

// Replays the production builders without passing later dated rows to training.
// Current row revisions/statuses are NOT historical snapshots; never label this
// a prospective accuracy result. Nonoverlapping holdouts avoid scoring a day twice.
function buildForecastValidation({ metric, through, transactions = [], refunds = [], trafficRows = [] }) {
  if (!['sales', 'traffic'].includes(metric)) throw Object.assign(new Error('Unknown forecast check.'), { statusCode: 400 })
  const end = calendarStart(through)
  if (!end) throw Object.assign(new Error('Invalid forecast check date.'), { statusCode: 400 })
  const horizon = config.FORECAST_DAYS, trainingDays = config.TRAILING_DAYS
  const from = new Date(end.getTime() - (trainingDays + FOLDS * horizon - 1) * DAY_MS)
  const until = new Date(end.getTime() + DAY_MS)
  const sales = inWindow(transactions, from, until), losses = inWindow(refunds, from, until)
  const traffic = inWindow(trafficRows, from, until)
  for (const row of sales) {
    if (row.total == null || !Number.isFinite(Number(row.total)) || Number(row.total) < 0) throw unavailable()
  }
  for (const row of losses) {
    if (row.refund_amount == null || !Number.isFinite(Number(row.refund_amount)) || Number(row.refund_amount) < 0) throw unavailable()
  }
  const actuals = metric === 'sales' ? netDailySales(sales, losses)
    : Object.fromEntries([...aggregateTraffic(traffic)].map(([date, row]) => [date, row.customers]))
  const allPairs = [], commonModel = [], commonBaseline = []
  const folds = Array.from({ length: FOLDS }, (_, index) => {
    const origin = new Date(end.getTime() - (FOLDS - index) * horizon * DAY_MS)
    const trainFrom = new Date(origin.getTime() - (trainingDays - 1) * DAY_MS)
    const trainUntil = new Date(origin.getTime() + DAY_MS)
    const trainSales = inWindow(sales, trainFrom, trainUntil), trainRefunds = inWindow(losses, trainFrom, trainUntil)
    const trainTraffic = inWindow(traffic, trainFrom, trainUntil)
    const trainActuals = metric === 'sales' ? netDailySales(trainSales, trainRefunds)
      : Object.fromEntries([...aggregateTraffic(trainTraffic)].map(([date, row]) => [date, row.customers]))
    const prediction = metric === 'sales' ? buildSalesForecast(trainActuals, dayKey(origin), config)
      : buildTrafficForecast(trainTraffic, dayKey(origin), config)
    const dates = Array.from({ length: horizon }, (_, day) => dayKey(new Date(origin.getTime() + (day + 1) * DAY_MS)))
    const known = date => actuals[date] != null && Number.isFinite(actuals[date]) && actuals[date] >= 0
    const observed = dates.filter(known).length
    const status = prediction.status !== 'ready' ? 'insufficient_training' : observed !== horizon ? 'missing_actuals' : 'scored'
    const pairs = status === 'scored' ? prediction.forecast.map(row => ({ date: row.date,
      actual: actuals[row.date], predicted: metric === 'sales' ? row.predictedRevenue : row.predictedCustomers })) : []
    const baseline = pairs.map(pair => ({ ...pair, predicted: trainActuals[dayKey(new Date(calendarStart(pair.date).getTime() - horizon * DAY_MS))] }))
    const baselineAvailable = pairs.length === horizon && baseline.every(pair => pair.predicted != null && Number.isFinite(pair.predicted))
    allPairs.push(...pairs)
    // Compare both models on identical complete weeks, not different cohorts.
    if (baselineAvailable) { commonModel.push(...pairs); commonBaseline.push(...baseline) }
    return { origin: dayKey(origin), trainingFrom: dayKey(trainFrom), from: dates[0], through: dates.at(-1), status,
      observedActualDays: observed, trainingObservedDays: prediction.training.observedDays,
      metrics: metrics(pairs), baselineAvailable }
  })
  const comparisonModel = metrics(commonModel), baselineMetrics = metrics(commonBaseline)
  const modelError = commonModel.reduce((sum, pair) => sum + Math.abs(pair.actual - pair.predicted), 0)
  const baselineError = commonBaseline.reduce((sum, pair) => sum + Math.abs(pair.actual - pair.predicted), 0)
  return { metric, status: allPairs.length ? 'replay_available' : 'insufficient_history',
    method: { id: 'rolling_weekly_holdouts', label: 'Four rolling weekly holdouts', folds: FOLDS, trainingDays, horizonDays: horizon,
      forecastModel: 'Same-weekday moving average', minimumSamplesPerWeekday: config.FORECAST_MIN_WEEKDAY_SAMPLES },
    readWindow: { from: dayKey(from), through },
    evaluation: { from: folds[0].from, through }, folds,
    coverage: { attemptedFolds: FOLDS, scoredFolds: folds.filter(fold => fold.status === 'scored').length,
      scoredDays: allPairs.length, missingActualDays: folds.reduce((sum, fold) => sum + horizon - fold.observedActualDays, 0),
      insufficientTrainingFolds: folds.filter(fold => fold.status === 'insufficient_training').length },
    metrics: metrics(allPairs),
    comparison: { label: 'Same weekday last week', days: commonModel.length, model: comparisonModel, baseline: baselineMetrics,
      lowerError: !commonModel.length ? null : Math.abs(modelError - baselineError) < 1e-9 ? 'tie' : modelError < baselineError ? 'model' : 'baseline' },
    dataQuality: { complete: true, timeZone: 'Asia/Manila', recordingCoverage: 'unknown', historicalSnapshots: false,
      basis: 'current_record_replay', currentDayExcluded: true },
    limitations: [
      'Retrospective check using current records, not frozen historical forecasts. Later edits can affect the results; this does not prove future accuracy.',
      ...(metric === 'sales' ? ['Current refund statuses can reflect later events in historical training. Sales results are revised-record comparisons, not the forecasts staff actually saw.'] : []),
      'Only complete seven-day holdouts with enough earlier training and recorded results for every day are scored. Missing recordings are unknown, not zero; coverage is not verified.',
      'MAE is the average absolute daily error. WAPE is total absolute error divided by total recorded amount, as a percentage; it is unavailable when that total is zero. Lower error is better. WAPE is not an accuracy percentage.',
      'WAPE depends on the recorded volume in the scored period. Do not compare it across different periods or treat it as a guarantee of performance.',
      'The last-week benchmark is compared on the same complete weeks only. No automatic model switching, confidence percentage or prediction interval is inferred.',
      ...(metric === 'traffic' ? ['This checks daily customer forecasts only. Hourly peaks, lean periods and staffing advice have not been validated.'] : []),
    ] }
}

async function getForecastValidation({ metric, asOf, client, now = new Date() } = {}) {
  if (!['sales', 'traffic'].includes(metric)) throw Object.assign(new Error('Unknown forecast check.'), { statusCode: 400 })
  const window = validationWindow(asOf, now)
  const context = metric === 'sales' ? await readSalesHistory(client, window.from, window.until)
    : { trafficRows: await readTraffic(client, window.from, window.until) }
  return { ...buildForecastValidation({ metric, through: dayKey(window.through), ...context }),
    generatedAt: new Date(now).toISOString(), requestedAsOf: window.requestedAsOf, historical: window.historical }
}

module.exports = { buildForecastValidation, getForecastValidation, validationWindow }
