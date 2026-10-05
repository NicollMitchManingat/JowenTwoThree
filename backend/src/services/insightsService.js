// Deterministic AI Insights engine (no ML, no LLM — pure arithmetic).
// Every insight is computed from live Supabase rows with tunable rules in
// insightsConfig.js. Each insight carries a `numbers` allowlist: the exact
// figures any future narrator may repeat (anti-hallucination contract).
// Builders are pure and exported for unit tests; only fetchContext and
// getInsights touch the network.
const insightsConfig = require("./insightsConfig")

const DAY_MS = 24 * 3600 * 1000

function toNum(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function pad(n) {
  return String(n).padStart(2, "0")
}

function dayKeyLocal(d) {
  const t = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(t.getTime())) return null
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

function addDays(date, n) {
  const t = new Date(date)
  t.setDate(t.getDate() + n)
  return t
}

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
    hourly[d.getHours()].buyers += 1
    hourly[d.getHours()].customers += toNum(t.customer_count > 0 ? t.customer_count : 1)
  })
  ;(Array.isArray(trafficRows) ? trafficRows : []).forEach((r) => {
    const d = new Date(r && r.created_at)
    if (Number.isNaN(d.getTime())) return
    const n = Number(r.number_of_customer)
    if (!(n > 0)) return
    hourly[d.getHours()].walkIns += n
    hourly[d.getHours()].customers += n
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
  if (totals.size === 0) {
    ;(Array.isArray(txns) ? txns : []).forEach((t) => {
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

// 1. Demand forecast — each of the next FORECAST_DAYS averaged over the
// last SAME_WEEKDAY_OCCURRENCES same-weekday occurrences (trailing window).
// Falls back to the overall daily mean when a weekday never occurred;
// suppressed entirely when history is empty (no fake precision).
function forecastDemand(dailyTrailing, endISO, cfg = insightsConfig) {
  const values = Object.values(dailyTrailing || {})
  const historyTotal = values.reduce((s, v) => s + toNum(v), 0)
  if (values.length === 0 || !(historyTotal > 0)) return null
  const byWeekday = new Map()
  Object.entries(dailyTrailing).forEach(([day, amount]) => {
    const d = new Date(`${day}T12:00:00`)
    if (Number.isNaN(d.getTime())) return
    const list = byWeekday.get(d.getDay()) || []
    list.push(toNum(amount))
    byWeekday.set(d.getDay(), list)
  })
  const overallMean = historyTotal / values.length
  const end = new Date(endISO)
  const days = []
  for (let i = 1; i <= (cfg.FORECAST_DAYS || 7); i++) {
    const target = addDays(end, i)
    const same = (byWeekday.get(target.getDay()) || []).slice(-(cfg.SAME_WEEKDAY_OCCURRENCES || 4))
    const revenue = same.length > 0
      ? Math.round(same.reduce((s, v) => s + v, 0) / same.length)
      : Math.round(overallMean)
    days.push({ date: dayKeyLocal(target), revenue })
  }
  const total = days.reduce((s, d) => s + d.revenue, 0)
  const trailingKeys = Object.keys(dailyTrailing).sort().slice(-7)
  const trailingTotal = trailingKeys.reduce((s, k) => s + toNum(dailyTrailing[k]), 0)
  const pct = trailingTotal > 0 ? ((total - trailingTotal) / trailingTotal) * 100 : 0
  return {
    key: "forecast",
    metric: "Forecast Revenue",
    value: `${fmtPeso(total)} next 7 days`,
    insight: pct >= 0
      ? `Stock and staff for ${fmtPct(pct)} vs last 7 days`
      : `Plan lighter prep — ${fmtPct(pct)} vs last 7 days`,
    impact: pct >= 0 ? "Positive" : "Medium",
    numbers: [total, Math.round(pct * 10) / 10, trailingTotal],
    detail: { days, total },
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
      metric: "Dead Hours",
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

// Reads every source the six insights need in one parallel batch.
// Partial failures degrade to [] (insights that need missing data return
// null) — only a missing client throws, surfacing as HTTP 500.
async function fetchContext(client, { spanStart, end }, limits) {
  if (!client) throw new Error("Supabase is not configured")
  const L = limits || {}
  const txnCols = "id,created_at,subtotal,discount,total,payment_method,discount_type,discount_id,status,customer_count,cart"
  const get = async (build, fallback) => {
    try {
      const res = await build()
      if (res.error) throw res.error
      return res.data || fallback
    } catch {
      return fallback
    }
  }
  const [
    txns, trafficRows, inventory, recipes, adjustments, refunds, discounts, products, itemRows,
  ] = await Promise.all([
    get(() => client.from("transactions").select(txnCols).gte("created_at", spanStart).lte("created_at", end).order("created_at", { ascending: true }).range(0, L.transactions || 999), []),
    get(() => client.from("customer_traffic").select("created_at,number_of_customer").gte("created_at", spanStart).lte("created_at", end).order("created_at", { ascending: true }).range(0, L.traffic || 499), []),
    get(() => client.from("inventory").select("id,name,stock_quantity,unit").order("name").range(0, L.inventory || 100), []),
    get(() => client.from("product_recipes").select("product_id,inventory_id,qty_per_sale").range(0, L.recipes || 499), []),
    get(() => client.from("inventory_adjustments").select("inventory_id,change_amount,reason,created_at").gte("created_at", spanStart).lte("created_at", end).order("created_at", { ascending: true }).range(0, L.adjustments || 499), []),
    get(() => client.from("refunds").select("refund_amount,created_at,transaction_id").gte("created_at", spanStart).lte("created_at", end).order("created_at", { ascending: true }).range(0, L.refunds || 499), []),
    get(() => client.from("discounts").select("*").order("name").range(0, L.discounts || 99), []),
    get(() => client.from("products").select("id,product_name").order("product_name").range(0, L.products || 100), []),
    // Item dates live on the parent transaction (same join the POS uses),
    // with cart-JSONB fallback applied later when items yield nothing.
    get(() => client.from("transaction_items").select("quantity,product_id,transactions!inner(created_at)").gte("transactions.created_at", spanStart).range(0, L.items || 999), []),
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
    windowDays,
  } = ctx
  const dailyTrailing = netDailySales(trailingTxns, trailingRefunds)
  const { hourly, split } = trafficBins(trailingTxns, trafficRows)
  const units = unitsSoldByProduct(itemRows, trailingTxns)
  const hourlyRevenue = Array.from({ length: 24 }, () => 0)
  ;(Array.isArray(trailingTxns) ? trailingTxns : []).forEach((t) => {
    if (t && t.status === "REFUNDED") return
    const d = new Date(t && t.created_at)
    if (Number.isNaN(d.getTime())) return
    hourlyRevenue[d.getHours()] += toNum(t && t.total)
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
    forecastDemand(dailyTrailing, endISO, cfg),
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
// Throws when Supabase isn't configured (HTTP 500); partial fetch
// failures degrade to fewer insights, never a crash.
async function getInsights({ start, end, client } = {}, cfg = insightsConfig) {
  // Explicit client:null means misconfigured (used by tests); an absent
  // key falls back to the configured Supabase client.
  const supabase = client !== undefined ? client : require("../config/supabaseClient").supabase
  if (!supabase) throw new Error("Supabase is not configured")
  const endDate = end ? new Date(end) : new Date()
  if (Number.isNaN(endDate.getTime())) throw new Error("Invalid end date")
  const windowDays = cfg.TRAILING_DAYS || 28
  const endISO = endDate.toISOString()
  const trailingStart = new Date(endDate.getTime() - windowDays * DAY_MS).toISOString()
  const rangeStart = start ? new Date(start).toISOString() : trailingStart
  if (Number.isNaN(new Date(rangeStart).getTime())) throw new Error("Invalid start date")
  const spanStart = rangeStart < trailingStart ? rangeStart : trailingStart
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
  const trailingItems = Array.isArray(rows.itemRows) ? rows.itemRows : []
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
  }, cfg)
  return {
    generatedAt: new Date().toISOString(),
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
