const { DAY_MS, dayKey, dayStart, readAll } = require('./analyticsReadService')
const units = require('./inventorySupabaseStore')

const WASTE_REASONS = new Set(['spoiled', 'expired', 'damaged', 'overproduction', 'other', 'wastage'])
const unavailable = () => Object.assign(new Error('Inventory analytics data needs review. Please retry.'), { statusCode: 503 })

// Source quantities remain exact decimal strings. Ratios are estimates; only
// their serialization is rounded. Decisions/comparisons use integer fractions.
function decimal(value) {
  const text = String(value ?? '')
  if (!/^-?\d+(\.\d+)?$/.test(text) || text.length > 256) throw unavailable()
  const [whole, fraction = ''] = text.split('.')
  return { n: BigInt(whole + fraction), d: 10n ** BigInt(fraction.length) }
}
const add = (a, b) => {
  // Source and multiplied decimal denominators are powers of ten. Align them
  // instead of multiplying denominators across thousands of adjustment rows.
  const d = a.d > b.d ? a.d : b.d
  return { n: a.n * (d / a.d) + b.n * (d / b.d), d }
}
const multiply = (a, b) => ({ n: a.n * b.n, d: a.d * b.d })
const zero = () => ({ n: 0n, d: 1n })
function exactText(value) {
  const scale = value.d.toString().length - 1
  if (scale === 0) return value.n.toString()
  const digits = value.n.toString().padStart(scale + 1, '0')
  return (digits.slice(0, -scale) + '.' + digits.slice(-scale)).replace(/\.?0+$/, '')
}
function textOf(value) {
  if (value.n === 0n) return '0'
  const places = Math.max(12, 16 - (value.n.toString().length - value.d.toString().length))
  const scaled = (value.n * 10n ** BigInt(places) + value.d / 2n) / value.d
  const digits = scaled.toString().padStart(places + 1, '0')
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(/\.?0+$/, '')
}
const version = value => /^(0|[1-9]\d{0,18})$/.test(String(value ?? '')) ? String(value) : null

function buildInventoryAnalytics({ inventory, recipes, transactions, items, adjustments, usageWindow, period, generatedAt }) {
  const sold = new Map(), recordedDays = new Set(), byTxn = new Map()
  let unmappedLines = 0
  for (const item of items) {
    if (!byTxn.has(item.transaction_id)) byTxn.set(item.transaction_id, [])
    byTxn.get(item.transaction_id).push(item)
  }
  const transactionIds = new Set(transactions.map(row => row.id))
  if (items.some(row => !transactionIds.has(row.transaction_id))) throw unavailable()
  for (const transaction of transactions) {
    const date = dayKey(transaction.created_at)
    if (!date) throw unavailable()
    recordedDays.add(date)
    const canonical = byTxn.has(transaction.id)
    const lines = canonical ? byTxn.get(transaction.id) : transaction.cart
    if (!Array.isArray(lines) || !lines.length) { unmappedLines++; continue }
    for (const line of lines) {
      const id = canonical ? line.product_id : line.product_id ?? line.productId ?? line.id
      const quantity = line.quantity ?? line.qty
      if (!id || quantity == null) { unmappedLines++; continue }
      const amount = decimal(quantity)
      if (amount.n <= 0n) { unmappedLines++; continue }
      sold.set(String(id), add(sold.get(String(id)) || zero(), amount))
    }
  }
  const recipeByIngredient = new Map()
  for (const recipe of recipes) {
    const id = String(recipe.inventory_id)
    if (!recipeByIngredient.has(id)) recipeByIngredient.set(id, [])
    recipeByIngredient.get(id).push(recipe)
  }
  const planning = inventory.filter(item => item.is_active !== false).map(item => {
    const stock = decimal(item.stock_quantity)
    if (stock.n < 0n) throw unavailable()
    const linked = recipeByIngredient.get(String(item.id)) || []
    const currentVersion = version(item.unit_version)
    let status = !linked.length ? 'no_recipe' : unmappedLines ? 'incomplete_sales' : !recordedDays.size ? 'no_sales' : 'estimated'
    let usage = zero()
    for (const recipe of linked) {
      const quantity = decimal(recipe.qty_per_sale)
      if (currentVersion === null || version(recipe.inventory_unit_version) !== currentVersion || quantity.n <= 0n) {
        status = 'unit_review'; continue
      }
      usage = add(usage, multiply(quantity, sold.get(String(recipe.product_id)) || zero()))
    }
    if (status === 'estimated' && usage.n === 0n) status = 'no_recorded_usage'
    const row = { id: item.id, name: item.name, unit: item.unit, unitVersion: currentVersion,
      quantity: String(item.stock_quantity), status, dailyUsage: null, daysCover: null,
      sevenDayUsage: null, shortage: null, recommendation: 'Review usage history' }
    if (status === 'estimated') {
      const days = BigInt(recordedDays.size)
      const daily = { n: usage.n, d: usage.d * days }
      const week = { n: daily.n * 7n, d: daily.d }
      const difference = week.n * stock.d - stock.n * week.d
      const shortage = { n: difference > 0n ? difference : 0n, d: week.d * stock.d }
      Object.assign(row, { dailyUsage: textOf(daily), sevenDayUsage: textOf(week),
        daysCover: textOf({ n: stock.n * daily.d, d: stock.d * daily.n }), shortage: textOf(shortage),
        recommendation: stock.n === 0n ? 'Out of stock; review replenishment' : difference > 0n ? 'Review replenishment' : 'Monitor quantity' })
    } else if (status === 'unit_review') row.recommendation = 'Review recipe unit versions'
    else if (status === 'incomplete_sales') row.recommendation = 'Review unmapped sale lines'
    else if (status === 'no_recipe') row.recommendation = 'Review recipe links'
    return row
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)))

  const inventoryById = new Map(inventory.map(item => [String(item.id), item]))
  const groups = new Map()
  let ignoredPositiveEntries = 0
  for (const adjustment of adjustments) {
    const reason = String(adjustment.reason || '').trim().toLowerCase()
    if (!WASTE_REASONS.has(reason)) continue
    const amount = decimal(adjustment.change_amount)
    if (amount.n >= 0n) { ignoredPositiveEntries++; continue }
    const item = inventoryById.get(String(adjustment.inventory_id))
    const recordedVersion = version(adjustment.unit_version)
    const known = typeof adjustment.unit_snapshot === 'string' && adjustment.unit_snapshot.trim() && recordedVersion !== null
    const key = JSON.stringify([adjustment.inventory_id, known ? adjustment.unit_snapshot : null, known ? recordedVersion : null])
    if (!groups.has(key)) groups.set(key, { id: key, inventoryId: adjustment.inventory_id,
      name: item?.name || 'Unknown ingredient', active: item?.is_active !== false,
      unit: known ? adjustment.unit_snapshot : null, unitVersion: known ? recordedVersion : null,
      currentUnit: !!known && item?.unit === adjustment.unit_snapshot && version(item?.unit_version) === recordedVersion,
      entries: 0, reasons: new Set(), amount: zero() })
    const group = groups.get(key)
    group.entries++; group.reasons.add(reason)
    if (known) group.amount = add(group.amount, { n: -amount.n, d: amount.d })
  }
  const wastage = [...groups.values()].map(({ amount, reasons, ...row }) => ({ ...row,
    quantity: row.unit === null ? null : exactText(amount), reasons: [...reasons].sort() }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.unit).localeCompare(String(b.unit)) || String(a.unitVersion).localeCompare(String(b.unitVersion)))
  return { planning, wastage, period, generatedAt,
    usageWindow: { ...usageWindow, recordedSalesDays: recordedDays.size },
    dataQuality: { complete: true, recordingCoverage: 'unknown', recipeBasis: 'current_recipes', unmappedLines,
      unknownUnitWastageEntries: wastage.filter(row => row.unit === null).reduce((sum, row) => sum + row.entries, 0), ignoredPositiveEntries },
  }
}

async function getInventoryAnalytics({ start, end, client, now = new Date() } = {}) {
  const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(new Date(value).getTime())
  if ((start !== undefined && !timestamp(start)) || (end !== undefined && !timestamp(end))) throw Object.assign(new Error('Provide valid start/end timestamps with a timezone.'), { statusCode: 400 })
  const stop = new Date(Math.min(end ? new Date(end).getTime() : now.getTime(), now.getTime()))
  const first = start ? new Date(start) : new Date(dayStart(stop).getTime() - 28 * DAY_MS)
  if (first > stop) throw Object.assign(new Error('Start must not follow the end of the period.'), { statusCode: 400 })
  const anchor = dayStart(stop).getTime()
  const complete = stop.getTime() === anchor + DAY_MS - 1 && stop < dayStart(now)
  const usageUntil = new Date(complete ? anchor + DAY_MS : anchor)
  const usageFrom = new Date(usageUntil.getTime() - 28 * DAY_MS)
  const database = client !== undefined ? client : require('../config/supabaseClient').supabase
  if (!database) throw unavailable()
  const read = (label, build) => readAll(build, { label })
  const [inventory, recipes, transactions, items, adjustments] = await Promise.all([
    read('Inventory', (a, b) => units.readUnitRows(versioned => database.from('inventory').select(units.inventoryColumns(versioned)).order('id').range(a, b))),
    read('Recipes', (a, b) => database.from('product_recipes').select('product_id,inventory_id,qty_per_sale:qty_per_sale::text,inventory_unit_version:inventory_unit_version::text').order('product_id').order('inventory_id').range(a, b)),
    read('Sales', (a, b) => database.from('transactions').select('id,created_at,cart').gte('created_at', usageFrom.toISOString()).lt('created_at', usageUntil.toISOString()).order('id').range(a, b)),
    read('Sold items', (a, b) => database.from('transaction_items').select('id,transaction_id,product_id,quantity,transactions!inner(created_at)').gte('transactions.created_at', usageFrom.toISOString()).lt('transactions.created_at', usageUntil.toISOString()).order('id').range(a, b)),
    read('Wastage', (a, b) => units.readUnitRows(versioned => database.from('inventory_adjustments').select('id,inventory_id,created_at,reason,change_amount:change_amount::text' + (versioned ? ',unit_snapshot,unit_version:unit_version::text' : '')).gte('created_at', first.toISOString()).lte('created_at', stop.toISOString()).order('id').range(a, b))),
  ])
  return buildInventoryAnalytics({ inventory, recipes, transactions, items, adjustments,
    usageWindow: { from: dayKey(usageFrom), through: dayKey(new Date(usageUntil.getTime() - 1)), calendarDays: 28 },
    period: { start: first.toISOString(), end: stop.toISOString() }, generatedAt: now.toISOString() })
}

module.exports = { getInventoryAnalytics, buildInventoryAnalytics }
