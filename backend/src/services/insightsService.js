// Deterministic AI Insights engine (no ML, no LLM — pure arithmetic).
// Every insight is computed from live Supabase rows with tunable rules in
// insightsConfig.js. Each insight carries a `numbers` allowlist: the exact
// figures any future narrator may repeat (anti-hallucination contract).
// Builders are pure and exported for unit tests; only fetchContext and
// getInsights touch the network.
const insightsConfig = require("./insightsConfig")
const unitReads = require("./inventorySupabaseStore")
const { buildSalesForecast } = require("./salesForecastMath")

const { DAY_MS, dayKey, hourOf, dayStart, readAll } = require("./analyticsReadService")

function toNum(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function dayKeyLocal(value) { return dayKey(value) }

function fmtPeso(n) {
  const safe = Number.isFinite(Number(n)) ? Number(n) : 0
  return `₱${Math.round(safe).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`
}

function fmtHour(h) {
  const hh = ((Number(h) % 24) + 24) % 24
  const suffix = hh < 12 ? "AM" : "PM"
  const twelve = hh % 12 === 0 ? 12 : hh % 12
  return `${twelve} ${suffix}`
}

function fmtPct(n, digits = 0) {
  const v = Number(n)
  const sign = v > 0 ? "+" : v < 0 ? "−" : ""
  return `${sign}${Math.abs(v).toFixed(digits)}%`
}

// Net daily revenue {YYYY-MM-DD: amount}: fully-refunded orders contribute
// nothing, partial refunds net out on the refund date (cash basis, same as
// the dashboard's getDailySales).
function netDailySales(txns, refunds) {
  const daily = {}
  const refundedIds = new Set()
  const add = (timestamp, amount) => {
    const key = dayKeyLocal(timestamp)
    if (!key) return
    const n = Number(amount)
    if (!Number.isFinite(n)) return
    daily[key] = Math.max(0, (daily[key] || 0) + n)
  }
  ;(Array.isArray(txns) ? txns : []).forEach((t) => {
    if (t && t.status === "REFUNDED") {
      if (t.id) refundedIds.add(t.id)
      return
    }
    add(t && t.created_at, t && t.total)
  })
  ;(Array.isArray(refunds) ? refunds : []).forEach((r) => {
    if (r && r.transaction_id && refundedIds.has(r.transaction_id)) return
    add(r && r.created_at, -toNum(r && r.refund_amount))
  })
  return daily
}

// 24 hourly bins from transaction rows (buyers = order count per hour) and
// customer_traffic rows (walk-ins). Returns {hourly, split} mirroring the
// dashboard's two traffic queries.
function trafficBins(txns, trafficRows) {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour, customers: 0, walkIns: 0, buyers: 0,
  }))
  ;(Array.isArray(txns) ? txns : []).forEach((t) => {
    const d = new Date(t && t.created_at)
    if (Number.isNaN(d.getTime())) return
    hourly[hourOf(d)].buyers += 1
  })
  ;(Array.isArray(trafficRows) ? trafficRows : []).forEach((r) => {
    const d = new Date(r && r.created_at)
    if (Number.isNaN(d.getTime())) return
    const n = Number(r.number_of_customer)
    if (!(n > 0)) return
    hourly[hourOf(d)].walkIns += n
    hourly[hourOf(d)].customers += n
  })
  const split = hourly.map(({ hour, walkIns, buyers }) => ({ hour, walkIns, buyers }))
  return { hourly, split }
}

// Units sold per product over the window. Prefers transaction_items;
// falls back to cart JSONB only when items yield nothing (same rule as
// the dashboard's getTopSellingItems — never double-counts both).
function unitsSoldByProduct(itemRows, txns) {
  const totals = new Map()
  const add = (id, qty) => {
    if (!id) return
    const n = Number(qty)
    if (!(n > 0)) return
    totals.set(String(id), (totals.get(String(id)) || 0) + n)
  }
  ;(Array.isArray(itemRows) ? itemRows : []).forEach((r) => {
    add(r && (r.product_id ?? r.productId), r && (r.quantity ?? r.qty))
  })
  const represented = new Set((Array.isArray(itemRows) ? itemRows : []).map(row => row.transaction_id).filter(Boolean))
  if (totals.size === 0 || represented.size > 0) {
    ;(Array.isArray(txns) ? txns : []).forEach((t) => {
      if (represented.has(t?.id)) return
      const cart = Array.isArray(t && t.cart) ? t.cart : []
      cart.forEach((line) => {
        add(line && (line.product_id ?? line.productId ?? line.id), line && (line.qty ?? line.quantity))
      })
    })
  }
  return totals
}

// Voucher ROI replica of the dashboard's voucherStats: [{key,name,
// redemptions,pesos}] sorted by pesos desc. Legacy types resolve by name.
const LEGACY_DISCOUNT_LABELS = { pwd: "PWD", senior: "Senior", promo: "Promo" }

function voucherStats(txns, discounts) {
  const byId = new Map((Array.isArray(discounts) ? discounts : []).map((d) => [String(d.id), d]))
  const map = new Map()
  ;(Array.isArray(txns) ? txns : []).forEach((t) => {
    const pesos = toNum(t && t.discount)
    if (!(pesos > 0)) return
    let key
    let name
    if (t.discount_type === "voucher" && t.discount_id && byId.has(String(t.discount_id))) {
      const v = byId.get(String(t.discount_id))
      key = `voucher:${v.id}`
      name = v.name
    } else if (t.discount_type && LEGACY_DISCOUNT_LABELS[t.discount_type]) {
      key = t.discount_type
      name = LEGACY_DISCOUNT_LABELS[t.discount_type]
    } else if (t.discount_type === "voucher") {
      key = "voucher:unknown"
      name = "Voucher"
    } else {
      return
    }
    const prev = map.get(key) || { key, name, redemptions: 0, pesos: 0 }
    prev.redemptions += 1
    prev.pesos += pesos
    map.set(key, prev)
  })
  return [...map.values()].sort((a, b) => b.pesos - a.pesos)
}

// 1. Shared complete-day forecast. Sparse history suppresses this card.
function forecastDemand(dailyTrailing, endISO, cfg = insightsConfig) {
  const result = buildSalesForecast(dailyTrailing, dayKey(endISO), cfg)
  if (result.status !== 'ready') return null
  const lastWeek = result.history.slice(-7)
  const completeWeek = lastWeek.every(day => day.revenue !== null)
  const trailingTotal = completeWeek ? lastWeek.reduce((sum, day) => sum + day.revenue, 0) : null
  const pct = trailingTotal > 0 ? ((result.total - trailingTotal) / trailingTotal) * 100 : null
  return {
    key: 'forecast', metric: 'Forecast Revenue',
    value: fmtPeso(result.total) + ' next 7 days',
    insight: pct === null ? 'Plan prep using matching weekdays. Missing days are unknown; forecast accuracy is not yet evaluated.'
      : pct >= 0 ? 'Stock and staff for ' + fmtPct(pct) + ' vs last 7 days'
        : 'Plan lighter prep: ' + fmtPct(pct) + ' vs last 7 days',
    impact: pct !== null && pct >= 0 ? 'Positive' : 'Medium',
    numbers: pct === null ? [result.total] : [result.total, Math.round(pct * 10) / 10, trailingTotal],
    detail: { days: result.forecast.map(day => ({ date: day.date, revenue: day.predictedRevenue })),
      total: result.total, method: result.method, training: result.training },
  }
}

// 2. Peak staffing — top-2 trading hours by traffic with buyer conversion.
// Only fires when the top hour is both high-converting and far above mean.
function peakStaffing(hourly, split, cfg = insightsConfig) {
  const start = cfg.TRADING_START_HOUR || 0
  const end = cfg.TRADING_END_HOUR || 23
  const inHours = (hourly || []).filter((b) => b.hour >= start && b.hour <= end)
  if (inHours.length === 0) return null
  const mean = inHours.reduce((s, b) => s + toNum(b.customers), 0) / inHours.length
  if (!(mean > 0)) return null
  const byHour = new Map((split || []).map((s) => [s.hour, s]))
  const ranked = [...inHours].sort((a, b) => toNum(b.customers) - toNum(a.customers))
  const top = ranked[0]
  const row = byHour.get(top.hour) || { walkIns: 0, buyers: 0 }
  const conversion = row.walkIns > 0 ? row.buyers / row.walkIns : row.buyers > 0 ? 1 : 0
  if (!(conversion > (cfg.STAFFING_CONVERSION || 0.4))) return null
  if (!(toNum(top.customers) > mean * (cfg.STAFFING_PEAK_MULT || 1.5))) return null
  const second = ranked[1]
  return {
    key: "staffing",
    metric: "Peak Hours",
    value: `${fmtHour(top.hour)} – ${fmtHour(top.hour + 1)}`,
    insight: second && toNum(second.customers) > 0
      ? `Schedule 2 extra staff · second peak ${fmtHour(second.hour)}`
      : "Schedule 2 extra staff",
    impact: "High",
    numbers: [top.hour, Math.round(toNum(top.customers)), Math.round(conversion * 100)],
    detail: { topHour: top.hour, customers: top.customers, conversion },
  }
}

// 3. Reorder cover — days-of-cover per ingredient from recipes × sales
// velocity. Zero-velocity ingredients are excluded (never infinite-cover).
function reorderCover({ inventory, recipes, unitsByProduct, windowDays }, cfg = insightsConfig) {
  const units = unitsByProduct instanceof Map ? unitsByProduct : new Map()
  const flagged = []
  ;(Array.isArray(inventory) ? inventory : []).forEach((inv) => {
    const stock = Number(inv && inv.stock_quantity)
    if (!Number.isFinite(stock)) return
    let use = 0
    ;(Array.isArray(recipes) ? recipes : []).forEach((r) => {
      if (String(r && r.inventory_id) !== String(inv && inv.id)) return
      use += toNum(r.qty_per_sale) * toNum(units.get(String(r.product_id)))
    })
    const dailyUse = use / Math.max(1, Number(windowDays) || 1)
    if (!(dailyUse > 0)) return
    const cover = stock / dailyUse
    if (cover < (cfg.REORDER_COVER_DAYS || 7)) {
      flagged.push({ id: inv.id, name: inv.name, stock, cover })
    }
  })
  flagged.sort((a, b) => a.cover - b.cover)
  const top = flagged.slice(0, cfg.REORDER_TOP_N || 3)
  if (top.length === 0) return null
  const coverStr = (c) => (c < 10 ? (Math.round(c * 10) / 10).toString() : String(Math.round(c)))
  return {
    key: "reorder",
    metric: "Reorder Now",
    value: `${top[0].name} · ~${coverStr(top[0].cover)}d left`,
    insight: top.length > 1
      ? `Reorder ${top.map((t) => t.name).join(", ")} first`
      : `Reorder ${top[0].name} first`,
    impact: "Reorder",
    numbers: top.map((t) => Math.round(t.cover * 10) / 10),
    detail: { items: top },
  }
}

// 4. Wastage risk — spoiled-unit share of on-hand stock, naming the top
// spoiled item (with its slow-selling product when recipes link one).
function wastageRisk({ adjustments, inventory, recipeLinks, slowProducts }, cfg = insightsConfig) {
  const items = (Array.isArray(inventory) ? inventory : []).filter(item => item && item.is_active !== false)
  // Preserve the original aggregate for the unchanged generic-unit baseline.
  // Once physical units/versions exist, compare only within one ingredient and
  // its recorded current version. Never infer old units from today's label.
  const genericBaseline = items.every(item => ['', 'units'].includes(String(item.unit || '').trim().toLowerCase()) && String(item.unit_version ?? 0) === '0') &&
    (Array.isArray(adjustments) ? adjustments : []).every(adjustment =>
      (adjustment?.unit_snapshot == null && adjustment?.unit_version == null) ||
      (adjustment?.unit_snapshot === 'units' && String(adjustment?.unit_version) === '0'))
  if (!genericBaseline) return unitAwareWastage({ adjustments, inventory: items, recipeLinks, slowProducts }, cfg)

  const reasons = (cfg.WASTAGE_REASONS || []).map((r) => String(r).toLowerCase())
  const byItem = new Map()
  let spoiledUnits = 0
  ;(Array.isArray(adjustments) ? adjustments : []).forEach((a) => {
    const reason = String((a && a.reason) || "").toLowerCase()
    if (!reasons.some((r) => reason.includes(r))) return
    const units = Math.abs(toNum(a && a.change_amount))
    if (!(units > 0)) return
    spoiledUnits += units
    const id = String(a && a.inventory_id)
    byItem.set(id, (byItem.get(id) || 0) + units)
  })
  if (!(spoiledUnits > 0)) return null
  const stockBase = (Array.isArray(inventory) ? inventory : [])
    .reduce((s, i) => s + Math.max(0, toNum(i && i.stock_quantity)), 0)
  if (!(stockBase > 0)) return null
  const share = (spoiledUnits / stockBase) * 100
  if (!(share > (cfg.WASTAGE_SHARE || 0.15) * 100)) return null
  const nameById = new Map((Array.isArray(inventory) ? inventory : []).map((i) => [String(i && i.id), i && i.name]))
  const [topId] = [...byItem.entries()].sort((a, b) => b[1] - a[1])[0]
  const topName = nameById.get(String(topId)) || "Unknown item"
  const slowSet = new Set((Array.isArray(slowProducts) ? slowProducts : []).map(String))
  const linked = ((recipeLinks && recipeLinks[String(topId)]) || []).filter((n) => slowSet.has(String(n)))
  return {
    key: "wastage",
    metric: "Wastage Risk",
    value: topName,
    insight: linked.length > 0
      ? `Use in promos — ${Math.round(share)}% spoiled, slow seller: ${linked[0]}`
      : `Use in promos — ${Math.round(share)}% of stock spoiled`,
    impact: "Medium",
    numbers: [Math.round(share), Math.round(spoiledUnits)],
    detail: { item: topName, share, units: spoiledUnits },
  }
}

// A percentage for one item is independent of whether another item uses kg,
// grams or liters. Unknown/older snapshots are exposed as incomplete coverage.
function unitAwareWastage({ adjustments, inventory, recipeLinks, slowProducts }, cfg) {
  const reasons = (cfg.WASTAGE_REASONS || []).map(reason => String(reason).toLowerCase())
  const byId = new Map(inventory.map(item => [String(item.id), item]))
  const totals = new Map()
  let excluded = 0
  for (const adjustment of Array.isArray(adjustments) ? adjustments : []) {
    if (!reasons.some(reason => String(adjustment?.reason || '').toLowerCase().includes(reason))) continue
    const amount = Math.abs(toNum(adjustment?.change_amount))
    if (!(amount > 0)) continue
    const item = byId.get(String(adjustment.inventory_id))
    if (!item || item.unit_version == null || adjustment.unit_version == null ||
      adjustment.unit_snapshot == null || adjustment.unit_snapshot !== item.unit ||
      String(adjustment.unit_version) !== String(item.unit_version)) { excluded++; continue }
    totals.set(String(item.id), (totals.get(String(item.id)) || 0) + amount)
  }
  const flagged = []
  for (const [id, units] of totals) {
    const item = byId.get(id), stock = Number(item.stock_quantity)
    if (!Number.isFinite(stock) || stock < 0) { excluded++; continue }
    const share = stock > 0 ? units / stock * 100 : null
    if (share === null || share > (cfg.WASTAGE_SHARE ?? 0.15) * 100) flagged.push({ item, units, share })
  }
  flagged.sort((left, right) => (right.share ?? Infinity) - (left.share ?? Infinity) || String(left.item.id).localeCompare(String(right.item.id)))
  if (!flagged.length) return excluded ? {
    key: 'wastage', metric: 'Wastage Review', value: 'Unit history incomplete',
    insight: 'Review stock adjustments with unrecorded or earlier units before assessing wastage.',
    impact: 'Medium', numbers: [], detail: { unitHistoryIncomplete: true, excludedAdjustments: excluded },
  } : null
  const { item, units, share } = flagged[0]
  const slowSet = new Set((Array.isArray(slowProducts) ? slowProducts : []).map(String))
  const linked = (recipeLinks?.[String(item.id)] || []).filter(name => slowSet.has(String(name)))
  const finding = share === null ? 'Review wastage: no stock remaining' : 'Use in promos: ' + Math.round(share) + "% of this item's current stock spoiled"
  return {
    key: 'wastage', metric: 'Wastage Risk', value: item.name || 'Unknown item',
    insight: finding + (linked.length ? ', slow seller: ' + linked[0] : '') +
      (excluded ? '. Unrecorded or earlier units are excluded.' : ''),
    impact: 'Medium', numbers: share === null ? [units] : [Math.round(share), units],
    detail: { item: item.name, share, units, unit: item.unit, unitVersion: String(item.unit_version),
      excludedAdjustments: excluded, unitSnapshotOnly: true },
  }
}

// 5. Promo lever — best voucher ROI to repeat, or an active DB voucher
// with zero redemptions to retire. Reuses voucherStats semantics.
function promoLever({ txns, discounts }, cfg = insightsConfig) {
  void cfg
  const stats = voucherStats(txns, discounts)
  if (stats.length > 0) {
    const best = stats[0]
    return {
      key: "promo",
      metric: "Promo Lever",
      value: best.name,
      insight: `Repeat ${best.name} — ${fmtPeso(best.pesos)} from ${best.redemptions} redemption${best.redemptions === 1 ? "" : "s"}`,
      impact: "Positive",
      numbers: [best.pesos, best.redemptions],
      detail: { action: "repeat", stat: best },
    }
  }
  // stats is empty here, so any active DB voucher is by definition unused.
  const idle = (Array.isArray(discounts) ? discounts : []).find(
    (d) => d && d.is_active !== false && d.id
  )
  if (!idle) return null
  return {
    key: "promo",
    metric: "Promo Lever",
    value: idle.name,
    insight: `Retire ${idle.name} — no redemptions`,
    impact: "Medium",
    numbers: [0],
    detail: { action: "retire", stat: { key: `voucher:${idle.id}`, name: idle.name } },
  }
}

// 6. Anomaly flags — independent one-line rules; each fires on its own.
// range/trailing: {gross, refunds, discounts}. hourlyRevenue: 24 sums.
function anomalyFlags({ range, trailing, hourlyRevenue }, cfg = insightsConfig) {
  const out = []
  const rRate = range.gross > 0 ? (range.refunds / range.gross) * 100 : 0
  const tRate = trailing.gross > 0 ? (trailing.refunds / trailing.gross) * 100 : 0
  if ((tRate > 0 && rRate > tRate * (cfg.REFUND_MULT || 2)) ||
      (tRate === 0 && rRate > (cfg.REFUND_MIN_RATE || 5))) {
    out.push({
      key: "anomaly-refunds",
      metric: "Refund Spike",
      value: `${Math.round(rRate)}% refunded`,
      insight: `Look into your refunds — running hot vs your usual ${Math.round(tRate)}%`,
      impact: "High",
      numbers: [Math.round(rRate * 10) / 10, Math.round(tRate * 10) / 10],
      detail: { rangeRate: rRate, trailingRate: tRate },
    })
  }
  const start = cfg.TRADING_START_HOUR || 0
  const end = cfg.TRADING_END_HOUR || 23
  const revenue = hourlyRevenue || []
  const revTotal = revenue.reduce((s, v) => s + toNum(v), 0)
  // No baseline revenue at all (brand-new business): hours aren't "dead",
  // there's just no history yet.
  const dead = []
  if (revTotal > 0) {
    for (let h = start; h <= end; h++) {
      if (!(toNum(revenue[h]) > 0)) dead.push(h)
    }
  }
  if (dead.length > 0) {
    out.push({
      key: "anomaly-hours",
      metric: "Lean Hours",
      value: dead.length === 1 ? fmtHour(dead[0]) : `${dead.length} quiet hours`,
      insight: `No revenue ${dead.slice(0, 3).map(fmtHour).join(", ")}${dead.length > 3 ? "…" : ""} — consider shorter shifts`,
      impact: "Medium",
      numbers: [dead.length],
      detail: { hours: dead },
    })
  }
  const rShare = range.gross > 0 ? (range.discounts / range.gross) * 100 : 0
  const tShare = trailing.gross > 0 ? (trailing.discounts / trailing.gross) * 100 : 0
  if (rShare - tShare > (cfg.DISCOUNT_CREEP_PTS || 5)) {
    out.push({
      key: "anomaly-discounts",
      metric: "Discount Creep",
      value: `${Math.round(rShare)}% given away`,
      insight: `Review your discounts — share up ${Math.round(rShare - tShare)}pts vs trailing`,
      impact: "Medium",
      numbers: [Math.round(rShare), Math.round(tShare)],
      detail: { rangeShare: rShare, trailingShare: tShare },
    })
  }
  return out
}

function summarizeTxns(txns) {
  const list = Array.isArray(txns) ? txns : []
  return list.reduce(
    (s, t) => ({
      gross: s.gross + toNum(t && t.subtotal),
      refunds: s.refunds,
      discounts: s.discounts + toNum(t && t.discount),
      total: s.total + toNum(t && t.total),
    }),
    { gross: 0, refunds: 0, discounts: 0, total: 0 }
  )
}

// Each source must be fully read. A failed/capped source cannot become zero
// activity, a forecast, or an "all clear" recommendation.
async function fetchContext(client, { spanStart, end }, limits = {}) {
  if (!client) throw new Error("Supabase is not configured")
  const get = (label, build, maxRows = limits.maxRows || 20000) => readAll(build, { label, maxRows })
  const timed = (table, columns, start, stop) => client.from(table).select(columns)
    .gte("created_at", spanStart).lte("created_at", end).order("created_at").order("id").range(start, stop)
  const [txns, trafficRows, inventory, recipes, adjustments, refunds, discounts, products, itemRows] = await Promise.all([
    get('Sales', (a, b) => timed('transactions', 'id,created_at,subtotal,discount,total,payment_method,discount_type,discount_id,status,customer_count,cart', a, b)),
    get('Customer traffic', (a, b) => timed('customer_traffic', 'id,created_at,number_of_customer', a, b), limits.trafficRows || 100000),
    get('Inventory', (a, b) => unitReads.readUnitRows(versioned => client.from('inventory').select(unitReads.inventoryColumns(versioned)).eq('is_active', true).order('id').range(a, b))),
    get('Recipes', (a, b) => client.from('product_recipes').select('product_id,inventory_id,qty_per_sale').order('product_id').order('inventory_id').range(a, b)),
    get('Adjustments', (a, b) => unitReads.readUnitRows(versioned => timed('inventory_adjustments', '*,change_amount_text:change_amount::text' + (versioned ? ',unit_version_text:unit_version::text' : ''), a, b))),
    get('Refunds', (a, b) => timed('refunds', 'id,refund_amount,created_at,transaction_id', a, b)),
    get('Discounts', (a, b) => client.from('discounts').select('*').order('id').range(a, b)),
    get('Products', (a, b) => client.from('products').select('id,product_name').order('id').range(a, b)),
    get('Sold items', (a, b) => client.from('transaction_items').select('id,transaction_id,quantity,product_id,transactions!inner(created_at)')
      .gte('transactions.created_at', spanStart).lte('transactions.created_at', end).order('id').range(a, b)),
  ])
  return { txns, trafficRows, inventory, recipes, adjustments, refunds, discounts, products, itemRows }
}

// Severity-first ordering for the card grid: action-now impacts above
// watch-items above good news (see IMPACT_SEVERITY). Ties keep composer
// order via the explicit index (stable regardless of engine sort).
// Exported for unit tests; buildInsights applies it before appending calm.
function sortInsightsBySeverity(insights, cfg = insightsConfig) {
  const table = (cfg && cfg.IMPACT_SEVERITY) || {}
  const rankOf = (impact) => {
    const r = table[impact]
    return Number.isFinite(r) ? r : Number.MAX_SAFE_INTEGER
  }
  return (Array.isArray(insights) ? insights : [])
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (rankOf(a.item && a.item.impact) - rankOf(b.item && b.item.impact)) || (a.index - b.index))
    .map(({ item }) => item)
}

// Composer: trends use the trailing window, descriptives the selected
// range (hybrid per design — stable over time and context-aware).
function buildInsights(ctx, cfg = insightsConfig) {
  const {
    endISO, rangeStartISO, trailingTxns, rangeTxns,
    trailingRefunds, rangeRefunds, trafficRows,
    inventory, recipes, itemRows, adjustments, discounts, products,
    windowDays, forecastTxns = trailingTxns, forecastRefunds = trailingRefunds, forecastEndISO = endISO,
  } = ctx
  const dailyTrailing = netDailySales(forecastTxns, forecastRefunds)
  const { hourly, split } = trafficBins(trailingTxns, trafficRows)
  const units = unitsSoldByProduct(itemRows, trailingTxns)
  const hourlyRevenue = Array.from({ length: 24 }, () => 0)
  ;(Array.isArray(trailingTxns) ? trailingTxns : []).forEach((t) => {
    if (t && t.status === "REFUNDED") return
    const d = new Date(t && t.created_at)
    if (Number.isNaN(d.getTime())) return
    hourlyRevenue[hourOf(d)] += toNum(t && t.total)
  })
  const range = summarizeTxns(rangeTxns)
  range.refunds = (Array.isArray(rangeRefunds) ? rangeRefunds : []).reduce((s, r) => s + toNum(r && r.refund_amount), 0)
  const trailing = summarizeTxns(trailingTxns)
  trailing.refunds = (Array.isArray(trailingRefunds) ? trailingRefunds : []).reduce((s, r) => s + toNum(r && r.refund_amount), 0)

  const qtyByProduct = [...units.entries()].sort((a, b) => b[1] - a[1])
  const slowCut = Math.max(1, Math.ceil(qtyByProduct.length / 4))
  const slowIds = new Set(qtyByProduct.slice(-slowCut).map(([id]) => String(id)))
  const nameByProduct = new Map((Array.isArray(products) ? products : []).map((p) => [String(p && p.id), (p && p.product_name) || ""]))
  const slowProducts = [...slowIds].map((id) => nameByProduct.get(id) || id).filter(Boolean)
  const recipeLinks = {}
  ;(Array.isArray(recipes) ? recipes : []).forEach((r) => {
    const key = String(r && r.inventory_id)
    const label = nameByProduct.get(String(r && r.product_id)) || String(r && r.product_id)
    if (!recipeLinks[key]) recipeLinks[key] = []
    if (!recipeLinks[key].includes(label)) recipeLinks[key].push(label)
  })

  const insights = sortInsightsBySeverity([
    forecastDemand(dailyTrailing, forecastEndISO, cfg),
    peakStaffing(hourly, split, cfg),
    reorderCover({ inventory, recipes, unitsByProduct: units, windowDays }, cfg),
    wastageRisk({ adjustments, inventory, recipeLinks, slowProducts }, cfg),
    promoLever({ txns: rangeTxns, discounts }, cfg),
    ...anomalyFlags({ range, trailing, hourlyRevenue }, cfg),
  ].filter(Boolean), cfg)

  if (insights.length > 0 && !insights.some((i) => i.key.indexOf("anomaly-") === 0)) {
    insights.push({
      key: "all-clear",
      metric: "Operations",
      value: "All clear",
      insight: "No anomalies in this period",
      impact: "Positive",
      numbers: [0],
      detail: {},
    })
  }
  void rangeStartISO
  return insights
}

// Full pipeline: windows → live fetch → compose. Trends anchor on a
// trailing window ending at `end`; descriptives use [start, end].
// Failed or incomplete reads stop recommendations instead of implying zero activity.
async function getInsights({ start, end, client } = {}, cfg = insightsConfig) {
  // Explicit client:null means misconfigured (used by tests); an absent
  // key falls back to the configured Supabase client.
  const supabase = client !== undefined ? client : require("../config/supabaseClient").supabase
  if (!supabase) throw new Error("Supabase is not configured")
  const now = new Date()
  const endDate = end ? new Date(end) : now
  if (Number.isNaN(endDate.getTime())) throw Object.assign(new Error("Invalid end date"), { statusCode: 400 })
  if (endDate > now) endDate.setTime(now.getTime())
  const windowDays = cfg.TRAILING_DAYS || 28
  const endISO = endDate.toISOString()
  const anchorStart = dayStart(endDate).getTime()
  const anchorEnd = anchorStart + DAY_MS - 1
  const completeAnchor = endDate.getTime() === anchorEnd && endDate < dayStart(now)
  const forecastEnd = new Date(completeAnchor ? anchorEnd : anchorStart - 1)
  const trailingStart = new Date(endDate.getTime() - windowDays * DAY_MS).toISOString()
  const forecastStart = new Date(dayStart(forecastEnd).getTime() + DAY_MS - windowDays * DAY_MS).toISOString()
  const startDate = start ? new Date(start) : new Date(trailingStart)
  if (!Number.isFinite(startDate.getTime())) throw Object.assign(new Error('Invalid start date'), { statusCode: 400 })
  const rangeStart = startDate.toISOString()
  if (Number.isNaN(new Date(rangeStart).getTime()) || new Date(rangeStart) > endDate) throw Object.assign(new Error("Invalid start date"), { statusCode: 400 })
  const spanStart = [rangeStart, trailingStart, forecastStart].sort()[0]
  const L = cfg.FETCH_LIMITS || {}
  const rows = await fetchContext(supabase, { spanStart, end: endISO, rangeStart }, L)
  const inWindow = (list, from) => (Array.isArray(list) ? list : []).filter((r) => {
    const t = new Date(r && r.created_at).getTime()
    return Number.isFinite(t) && t >= new Date(from).getTime() && t <= endDate.getTime()
  })
  const trailingTxns = inWindow(rows.txns, trailingStart)
  const rangeTxns = inWindow(rows.txns, rangeStart)
  const trailingRefunds = inWindow(rows.refunds, trailingStart)
  const rangeRefunds = inWindow(rows.refunds, rangeStart)
  const trailingTraffic = inWindow(rows.trafficRows, trailingStart)
  const trailingAdjustments = inWindow(rows.adjustments, trailingStart)
  const trailingItems = (rows.itemRows || []).filter(row => {
    const stamp = row.transactions?.created_at
    return stamp && new Date(stamp) >= new Date(trailingStart) && new Date(stamp) <= endDate
  })
  const insights = buildInsights({
    endISO,
    rangeStartISO: rangeStart,
    trailingTxns,
    rangeTxns,
    trailingRefunds,
    rangeRefunds,
    trafficRows: trailingTraffic,
    inventory: rows.inventory,
    recipes: rows.recipes,
    itemRows: trailingItems,
    adjustments: trailingAdjustments,
    discounts: rows.discounts,
    products: rows.products,
    windowDays,
    forecastTxns: inWindow(rows.txns, forecastStart).filter(row => new Date(row.created_at) <= forecastEnd),
    forecastRefunds: inWindow(rows.refunds, forecastStart).filter(row => new Date(row.created_at) <= forecastEnd),
    forecastEndISO: forecastEnd.toISOString(),
  }, cfg)
  return {
    generatedAt: now.toISOString(),
    dataQuality: {
      complete: true, timeZone: 'Asia/Manila', forecastThrough: forecastEnd.toISOString(),
      recordingCoverage: 'unknown', forecastFrom: forecastStart,
      notice: 'Forecast training uses complete Manila days only. Missing recording days are not assumed to be zero. Traffic uses recorded customer counts only; transactions are not added again.',
    },
    windowDays,
    range: { start: rangeStart, end: endISO },
    insights,
  }
}

module.exports = {
  insightsConfig,
  netDailySales,
  trafficBins,
  unitsSoldByProduct,
  voucherStats,
  forecastDemand,
  peakStaffing,
  reorderCover,
  wastageRisk,
  promoLever,
  anomalyFlags,
  buildInsights,
  sortInsightsBySeverity,
  fetchContext,
  getInsights,
  fmtPeso,
  fmtHour,
}
