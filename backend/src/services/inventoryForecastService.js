// Read-only ingredient charts. Current-unit sale deductions are a usage proxy;
// current recipes and unlinked historical baskets are never treated as actual use.
const { DAY_MS, dayStart, dayKey, calendarStart, readAll } = require('./analyticsReadService')
const units = require('./inventorySupabaseStore')
const { buildSalesForecast } = require('./salesForecastMath')
const { buildForecastValidation } = require('./forecastValidationService')
let stockHelpers
const stock = () => stockHelpers ||= import('../../../frontend/src/utils/formatStock.js')
const unavailable = text => Object.assign(new Error(text || 'Ingredient deduction history needs review.'), { statusCode: 503 })
const version = value => /^(0|[1-9]\d{0,18})$/.test(String(value ?? '')) ? String(value) : null
const numeric = value => value != null && /^-?\d+(\.\d+)?$/.test(String(value)) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= Number.MAX_SAFE_INTEGER

function bounds(start, end, now) {
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
  if (!valid(start) || !valid(end) || Date.parse(start) > Date.parse(end)) throw Object.assign(new Error('Choose a valid ingredient chart date range.'), { statusCode: 400 })
  const today = dayStart(now), requestedEnd = new Date(Math.min(Date.parse(end), now.getTime()))
  const through = dayStart(requestedEnd) < today ? dayStart(requestedEnd) : new Date(today.getTime() - DAY_MS)
  const first = dayStart(start), last = dayStart(requestedEnd)
  if (first > last || (last - first) / DAY_MS > 365) throw Object.assign(new Error('Choose an ingredient history range of at most 366 days, ending no later than today.'), { statusCode: 400 })
  const modelFirst = new Date(through.getTime() - 55 * DAY_MS)
  return { first, last, through, readFrom: first < modelFirst ? first : modelFirst, today, requestedEnd }
}

async function buildInventoryCharts({ inventory, adjustments, start, end, ingredientId, now = new Date() }) {
  const { addStock, subtractStock, compareStock } = await stock()
  const window = bounds(start, end, now)
  const ingredients = inventory.filter(item => item.is_active !== false).map(item => {
    if (!numeric(item.stock_quantity) || Number(item.stock_quantity) < 0 || !numeric(item.low_stock_threshold ?? '5') || Number(item.low_stock_threshold ?? '5') < 0) throw unavailable()
    return { id: String(item.id), name: item.name, unit: item.unit || 'Unrecorded', unitVersion: version(item.unit_version),
      quantity: String(item.stock_quantity), threshold: String(item.low_stock_threshold ?? '5') }
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  if (ingredientId != null && !ingredients.some(item => item.id === ingredientId)) throw Object.assign(new Error('Select an active inventory ingredient.'), { statusCode: 400 })
  const itemById = new Map(ingredients.map(item => [item.id, item]))
  const daily = new Map(ingredients.map(item => [item.id, new Map()])), excluded = new Map(ingredients.map(item => [item.id, new Set()]))
  const counts = new Map(ingredients.map(item => [item.id, { matching: 0, excluded: 0 }]))
  for (const adjustment of adjustments) {
    if (String(adjustment.reason).toLowerCase() !== 'sale') continue
    const item = itemById.get(String(adjustment.inventory_id))
    if (!item) continue
    const time = new Date(adjustment.created_at), date = dayKey(time)
    if (!date) throw unavailable()
    if (time < window.readFrom || time > window.requestedEnd) continue
    if (!numeric(adjustment.change_amount)) throw unavailable()
    if (item.unitVersion === null || version(adjustment.unit_version) !== item.unitVersion || adjustment.unit_snapshot !== item.unit || Number(adjustment.change_amount) > 0) {
      excluded.get(item.id).add(date); counts.get(item.id).excluded++; continue
    }
    const amount = String(adjustment.change_amount).replace(/^-/, '')
    const previous = daily.get(item.id).get(date) || '0', total = addStock(previous, amount)
    if (total == null || !numeric(total)) throw unavailable()
    daily.get(item.id).set(date, total); counts.get(item.id).matching++
  }
  // A date containing incompatible entries cannot be scored as complete usage.
  for (const item of ingredients) for (const date of excluded.get(item.id)) daily.get(item.id).delete(date)
  const dates = Array.from({ length: Math.round((window.last - window.first) / DAY_MS) + 1 }, (_, i) => dayKey(new Date(window.first.getTime() + i * DAY_MS)))
  const comparison = { dates, items: ingredients.map(item => {
    const values = dates.map(date => daily.get(item.id).get(date) ?? null)
    const recorded = values.filter(value => value !== null)
    return { id: item.id, name: item.name, unit: item.unit, unitVersion: item.unitVersion, values,
      total: recorded.length ? recorded.reduce((sum, value) => addStock(sum, value), '0') : null,
      recordedDays: recorded.length, excludedDays: dates.filter(date => excluded.get(item.id).has(date)).length }
  }) }
  const selected = ingredientId ? itemById.get(ingredientId) : [...ingredients].sort((a, b) => daily.get(b.id).size - daily.get(a.id).size || a.name.localeCompare(b.name))[0]
  if (!selected) return { ingredients: [], comparison, selectedIngredientId: null, history: [], forecast: null, projection: [], validation: null,
    dataQuality: { complete: true, source: 'inventory_adjustments', recordingCoverage: 'unknown' }, generatedAt: now.toISOString() }
  const observations = daily.get(selected.id)
  const history = Array.from({ length: Math.round((window.last - window.first) / DAY_MS) + 1 }, (_, i) => {
    const date = dayKey(new Date(window.first.getTime() + i * DAY_MS))
    return { date, quantity: observations.has(date) ? observations.get(date) : null }
  })
  const dailySeries = Object.fromEntries([...observations].filter(([date]) => calendarStart(date) <= window.through).map(([date, value]) => [date, Number(value)]))
  const base = buildSalesForecast(dailySeries, dayKey(window.through), { FORECAST_DECIMAL_PLACES: 6 })
  const forecast = { ...base, history: base.history.map(row => ({ date: row.date, quantity: row.revenue })),
    forecast: base.forecast.map(row => ({ date: row.date, quantity: row.predictedRevenue })),
    notice: base.status === 'ready' ? 'Estimate based on recorded sales deductions in this ingredient unit/version. Missing deduction days remain unknown; unmet demand is not measured.'
      : 'Insufficient matching deduction history. At least two recorded days for each weekday in the preceding 28 complete days are required.' }
  const validation = { ...buildForecastValidation({ metric: 'inventory', through: dayKey(window.through), dailySeries }), generatedAt: now.toISOString() }
  const historical = window.through.getTime() < window.today.getTime() - DAY_MS
  const projection = []
  if (forecast.status === 'ready' && !historical) {
    projection.push({ date: dayKey(window.today), quantity: selected.quantity, demand: '0', shortage: '0' })
    const weekdayValues = new Map(forecast.forecast.map(row => [calendarStart(row.date).getUTCDay(), row.quantity]))
    let remaining = selected.quantity, shortage = '0'
    for (let i = 1; i <= 7; i++) {
      const date = new Date(window.today.getTime() + i * DAY_MS), demand = String(weekdayValues.get(date.getUTCDay()))
      if (compareStock(demand, remaining) > 0) { shortage = addStock(shortage, subtractStock(demand, remaining)); remaining = '0' }
      else remaining = subtractStock(remaining, demand)
      projection.push({ date: dayKey(date), quantity: remaining, demand, shortage })
    }
  }
  return { ingredients, comparison, selectedIngredientId: selected.id, selected, history, forecast, projection, validation,
    thresholdDate: projection.find(row => compareStock(row.quantity, selected.threshold) <= 0)?.date || null,
    projectionNotice: historical ? 'Historical starting balances are unavailable. Select a period ending today or yesterday to project current stock.'
      : 'Starts at the current balance and models seven complete days beginning tomorrow. No further deductions today, replenishment, wastage or other adjustments are assumed. Shortages are shown separately; stock is bounded at zero.',
    coverage: { matchingEntries: counts.get(selected.id).matching, excludedEntries: counts.get(selected.id).excluded,
      excludedDates: excluded.get(selected.id).size, historicalOrigin: historical, historyThrough: dayKey(window.through), currentUnitVersion: selected.unitVersion },
    dataQuality: { complete: true, source: 'inventory_adjustments', reason: 'sale', recordingCoverage: 'unknown', historicalSnapshots: false, basis: 'recorded_deductions', unmetDemandMeasured: false },
    generatedAt: now.toISOString() }
}

async function getInventoryCharts({ start, end, ingredientId, client, now = new Date(), signal } = {}) {
  const window = bounds(start, end, now)
  if (ingredientId !== undefined && (typeof ingredientId !== 'string' || !/^[a-f0-9-]{36}$/i.test(ingredientId))) throw Object.assign(new Error('Select a valid ingredient.'), { statusCode: 400 })
  const database = client || require('../config/supabaseClient').supabase
  if (!database) throw unavailable('Inventory analytics is unavailable.')
  const cancel = query => signal && query.abortSignal ? query.abortSignal(signal) : query
  const [inventory, adjustments] = await Promise.all([
    readAll((a, b) => units.readUnitRows(versioned => cancel(database.from('inventory').select(units.inventoryColumns(versioned)).eq('is_active', true).order('id').range(a, b))), { label: 'Inventory chart' }),
    readAll((a, b) => units.readUnitRows(versioned => cancel(database.from('inventory_adjustments').select('id,inventory_id,created_at,reason,change_amount:change_amount::text' + (versioned ? ',unit_snapshot,unit_version:unit_version::text' : ''))
      .eq('reason', 'sale').gte('created_at', window.readFrom.toISOString()).lte('created_at', window.requestedEnd.toISOString()).order('id').range(a, b))), { label: 'Ingredient history' }),
  ])
  return buildInventoryCharts({ inventory, adjustments, start, end, ingredientId, now })
}
module.exports = { buildInventoryCharts, getInventoryCharts }
