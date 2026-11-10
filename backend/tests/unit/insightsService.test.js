const {
  netDailySales,
  trafficBins,
  unitsSoldByProduct,
  voucherStats,
  forecastDemand,
  peakStaffing,
  trafficStaffingCards,
  reorderCover,
  wastageRisk,
  promoLever,
  anomalyFlags,
  buildInsights,
  fmtPeso,
  fmtHour,
} = require("../../src/services/insightsService")

const CFG = {
  TRAILING_DAYS: 28,
  SAME_WEEKDAY_OCCURRENCES: 4,
  FORECAST_DAYS: 7,
  REORDER_COVER_DAYS: 7,
  REORDER_TOP_N: 3,
  WASTAGE_REASONS: ["spoiled", "expired", "damaged"],
  WASTAGE_SHARE: 0.15,
  REFUND_MULT: 2,
  REFUND_MIN_RATE: 5,
  DISCOUNT_CREEP_PTS: 5,
  TRADING_START_HOUR: 8,
  TRADING_END_HOUR: 22,
  IMPACT_SEVERITY: { High: 0, Reorder: 0, Medium: 1, Positive: 2 },
}

describe("insightsService helpers", () => {
  it("fmtPeso and fmtHour should format for the card", () => {
    expect(fmtPeso(18500)).toBe("₱18,500")
    expect(fmtPeso("abc")).toBe("₱0")
    expect(fmtHour(12)).toBe("12 PM")
    expect(fmtHour(0)).toBe("12 AM")
    expect(fmtHour(23)).toBe("11 PM")
  })

  it("netDailySales should skip refunded orders and net refunds on refund date", () => {
    const txns = [
      { id: "t1", created_at: "2026-09-07T10:00:00+08:00", total: 300, status: "COMPLETED" },
      { id: "t4", created_at: "2026-09-07T11:00:00+08:00", total: 150, status: "REFUNDED" },
    ]
    const refunds = [
      { transaction_id: "t4", refund_amount: 150, created_at: "2026-09-07T12:00:00+08:00" },
      { transaction_id: "t1", refund_amount: 40, created_at: "2026-09-08T09:00:00+08:00" },
    ]
    const daily = netDailySales(txns, refunds)
    // t4 excluded and its refund skipped; the t1 refund lands on its own
    // date and clamps at zero (same cash-basis rule as the dashboard).
    expect(daily["2026-09-07"]).toBe(300)
    expect(daily["2026-09-08"]).toBe(0)
  })

  it("trafficBins should split buyers and walk-ins per hour", () => {
    const { hourly, split } = trafficBins(
      [{ created_at: "2026-09-07T12:10:00+08:00", customer_count: 2 }],
      [{ created_at: "2026-09-07T12:40:00+08:00", number_of_customer: 5 }]
    )
    expect(hourly).toHaveLength(24)
    expect(hourly[12]).toMatchObject({ hour: 12, buyers: 1, walkIns: 5, customers: 5 })
    expect(split[12]).toEqual({ hour: 12, walkIns: 5, buyers: 1 })
  })

  it("unitsSoldByProduct should prefer items and fall back to cart JSONB", () => {
    const fromItems = unitsSoldByProduct(
      [{ product_id: "p1", quantity: 3 }],
      [{ cart: [{ productId: "p2", qty: 9 }] }]
    )
    expect(Object.fromEntries(fromItems)).toEqual({ p1: 3 })
    const fromCart = unitsSoldByProduct([], [
      { cart: [{ product_id: "p2", quantity: 2 }, { id: "p3", qty: 1 }] },
    ])
    expect(Object.fromEntries(fromCart)).toEqual({ p2: 2, p3: 1 })
  })

  it("voucherStats should rank vouchers and resolve legacy types", () => {
    const stats = voucherStats(
      [
        { discount: 60, discount_type: "senior" },
        { discount: 75, discount_type: "voucher", discount_id: "v1" },
        { discount: 0, discount_type: null },
      ],
      [{ id: "v1", name: "Weekend 15%" }]
    )
    expect(stats.map((s) => s.name)).toEqual(["Weekend 15%", "Senior"])
    expect(stats[0]).toMatchObject({ redemptions: 1, pesos: 75 })
  })
})

describe('forecastDemand', () => {
  const daily = Object.fromEntries(Array.from({length:28},(_,i)=>['2026-09-'+String(i+1).padStart(2,'0'),100]))
  for(const [day,value] of Object.entries({'07':100,'14':200,'21':300,'28':400,'01':50,'08':50,'15':50,'22':50})) daily['2026-09-'+day]=value
  it('uses the same weekday averages and total as the Sales chart',()=>{
    const out=forecastDemand(daily,'2026-09-28T23:59:59.999+08:00',CFG)
    expect(out.detail.days[0]).toEqual({date:'2026-09-29',revenue:50})
    expect(out.detail.days[6]).toEqual({date:'2026-10-05',revenue:250})
    expect(out.detail.total).toBe(out.detail.days.reduce((sum,day)=>sum+day.revenue,0))
    expect(out.detail.method.id).toBe('same_weekday_average')
  })
  it('suppresses sparse history rather than using an unsupported overall mean',()=>{
    expect(forecastDemand({'2026-09-07':100},'2026-09-28T12:00:00+08:00',CFG)).toBeNull()
    expect(forecastDemand({},'2026-09-28T12:00:00+08:00',CFG)).toBeNull()
  })
  it('compares only a complete last calendar week',()=>{
    const missing={...daily};delete missing['2026-09-27']
    const out=forecastDemand(missing,'2026-09-28T12:00:00+08:00',CFG)
    expect(out).not.toBeNull();expect(out.insight).not.toContain('%');expect(out.numbers).toEqual([out.detail.total])
  })
  it('describes rising and falling forecasts without changing their values',()=>{
    for(const rising of [true,false]){
      const values=Object.fromEntries(Array.from({length:28},(_,i)=>['2026-09-'+String(i+1).padStart(2,'0'),i<21?(rising?100:10):(rising?50:1000)]))
      const out=forecastDemand(values,'2026-09-28T12:00:00+08:00',CFG)
      expect(out.impact).toBe(rising?'Positive':'Medium')
      expect(out.insight).toContain(rising?'Stock and staff':'Plan lighter prep')
    }
  })
})

describe('peakStaffing', () => {
  const rows = ['2026-09-21','2026-09-28'].flatMap(date => [
    {created_at:date+'T12:00:00+08:00',number_of_customer:20},
    {created_at:date+'T15:00:00+08:00',number_of_customer:4}])
  it('uses supported same-weekday forecasts without arbitrary staff counts', () => {
    const out = peakStaffing(rows, '2026-10-04T15:59:59Z', CFG)
    expect(out.key).toBe('staffing');expect(out.value).toContain('12 PM')
    expect(out.detail.date).toBe('2026-10-05');expect(out.insight).not.toMatch(/2 extra|conversion/)
    expect(out.detail.hours[0].predictedCustomers).toBe(20)
    const lean = trafficStaffingCards(rows, '2026-10-04T15:59:59Z', CFG)[1]
    expect(lean.metric).toBe('Expected Lean Hours');expect(lean.value).toContain('3 PM')
    expect(lean.detail.hours[0].samples).toBe(2)
  })
  it('suppresses sparse/flat hour advice', () => {
    expect(peakStaffing([], '2026-10-04', CFG)).toBeNull()
    expect(peakStaffing(rows.slice(0,2), '2026-10-04', CFG)).toBeNull()
    expect(peakStaffing(rows.map(row=>({...row,number_of_customer:4})), '2026-10-04', CFG)).toBeNull()
  })
})

describe("reorderCover", () => {
  const inventory = [
    { id: "i1", name: "Milk", stock_quantity: 2 },
    { id: "i2", name: "Beans", stock_quantity: 100 },
  ]
  const recipes = [
    { product_id: "p1", inventory_id: "i1", qty_per_sale: 0.2 },
    { product_id: "p1", inventory_id: "i2", qty_per_sale: 0.02 },
  ]
  const units = new Map([["p1", 280]]) // 10 sales/day over 28 days

  it("should rank ingredients by days of cover", () => {
    const out = reorderCover({ inventory, recipes, unitsByProduct: units, windowDays: 28 }, CFG)
    expect(out.key).toBe("reorder")
    expect(out.impact).toBe("Reorder")
    // Milk: 2 / (0.2*10) = 1 day; Beans: 100 / (0.02*10) = 500 days.
    expect(out.detail.items[0]).toMatchObject({ name: "Milk" })
    expect(out.value).toContain("Milk")
  })

  it("should exclude zero-velocity ingredients instead of infinite cover", () => {
    const out = reorderCover(
      { inventory, recipes: [], unitsByProduct: units, windowDays: 28 },
      CFG
    )
    expect(out).toBe(null)
  })
})

describe("wastageRisk", () => {
  it('never sums losses across kg, grams and liters after units are recorded', () => {
    const out = wastageRisk({ inventory: [
      { id: 'kg', name: 'Flour', unit: 'kg', unit_version: '1', stock_quantity: 10 },
      { id: 'ml', name: 'Milk', unit: 'mL', unit_version: '1', stock_quantity: 100000 },
    ], adjustments: [{ inventory_id: 'kg', change_amount: -2, reason: 'spoiled', unit_snapshot: 'kg', unit_version: '1' }] }, CFG)
    expect(out.value).toBe('Flour')
    expect(out.detail.share).toBe(20)
    expect(out.detail.unit).toBe('kg')
  })
  it('excludes unknown units and even matching labels from older versions', () => {
    const out = wastageRisk({ inventory: [{ id: 'i1', name: 'Flour', unit: 'kg', unit_version: '2', stock_quantity: 10 }],
      adjustments: [
        { inventory_id: 'i1', change_amount: -5000, reason: 'spoiled' },
        { inventory_id: 'i1', change_amount: -100, reason: 'spoiled', unit_snapshot: 'kg', unit_version: '0' },
      ] }, CFG)
    expect(out.metric).toBe('Wastage Review')
    expect(out.detail.excludedAdjustments).toBe(2)
    expect(out.numbers).toEqual([])
  })
  it('reports known current loss with an explicit incomplete-history warning', () => {
    const out = wastageRisk({ inventory: [{ id: 'i1', name: 'Flour', unit: 'g', unit_version: '1', stock_quantity: 1000 }],
      adjustments: [
        { inventory_id: 'i1', change_amount: -200, reason: 'spoiled', unit_snapshot: 'g', unit_version: '1' },
        { inventory_id: 'i1', change_amount: -3, reason: 'spoiled' },
      ] }, CFG)
    expect(out.detail.share).toBe(20)
    expect(out.detail.units).toBe(200)
    expect(out.insight).toMatch(/earlier units are excluded/)
  })
  it('does not invent a percentage when no current stock remains', () => {
    const out = wastageRisk({ inventory: [{ id: 'i1', name: 'Flour', unit: 'g', unit_version: '1', stock_quantity: 0 }],
      adjustments: [{ inventory_id: 'i1', change_amount: -2, reason: 'spoiled', unit_snapshot: 'g', unit_version: '1' }] }, CFG)
    expect(out.detail.share).toBeNull()
    expect(out.insight).toMatch(/no stock remaining/)
    expect(out.numbers.every(Number.isFinite)).toBe(true)
  })
  const inventory = [
    { id: "i1", name: "Strawberries", stock_quantity: 20 },
    { id: "i2", name: "Milk", stock_quantity: 80 },
  ]

  it("should flag spoilage share above threshold with the top item", () => {
    const out = wastageRisk(
      {
        adjustments: [{ inventory_id: "i1", change_amount: -20, reason: "Spoiled" }],
        inventory,
        recipeLinks: { i1: ["Berry Cake"] },
        slowProducts: ["Berry Cake"],
      },
      CFG
    )
    expect(out.key).toBe("wastage")
    expect(out.value).toBe("Strawberries")
    expect(out.insight).toMatch(/Berry Cake/)
  })

  it("should stay quiet below threshold or without spoilage", () => {
    expect(wastageRisk({ adjustments: [], inventory }, CFG)).toBe(null)
    expect(wastageRisk(
      { adjustments: [{ inventory_id: "i1", change_amount: -1, reason: "Spoiled" }], inventory },
      CFG
    )).toBe(null)
  })
})

describe("promoLever", () => {
  it("should repeat the best voucher by pesos", () => {
    const out = promoLever(
      {
        txns: [{ discount: 75, discount_type: "voucher", discount_id: "v1" }],
        discounts: [{ id: "v1", name: "Weekend 15%", is_active: true }],
      },
      CFG
    )
    expect(out.detail.action).toBe("repeat")
    expect(out.impact).toBe("Positive")
    expect(out.insight).toMatch(/Weekend 15%/)
  })

  it("should retire an active voucher with no redemptions", () => {
    const out = promoLever(
      { txns: [{ discount: 0, discount_type: null }], discounts: [{ id: "v9", name: "Flat Fifty", is_active: true }] },
      CFG
    )
    expect(out.detail.action).toBe("retire")
    expect(out.impact).toBe("Medium")
    expect(out.insight).toMatch(/Flat Fifty/)
  })

  it("should return null with no discount data", () => {
    expect(promoLever({ txns: [], discounts: [] }, CFG)).toBe(null)
  })
})

describe("anomalyFlags", () => {
  const hourlyRevenue = Array.from({ length: 24 }, (_, h) => (h >= 8 && h <= 22 ? 100 : 0))

  it("should flag financial anomalies without treating unrecorded hours as lean", () => {
    const dead = [...hourlyRevenue]
    dead[9] = 0
    const out = anomalyFlags(
      {
        range: { gross: 1000, refunds: 200, discounts: 200 },
        trailing: { gross: 4000, refunds: 100, discounts: 200 },
        hourlyRevenue: dead,
      },
      CFG
    )
    const keys = out.map((i) => i.key)
    // Financial spikes stay independent of missing hourly sales.
    expect(keys).toEqual(expect.arrayContaining(["anomaly-refunds", "anomaly-discounts"]))
    expect(keys).not.toContain("anomaly-hours")
    const byKey = new Map(out.map((i) => [i.key, i]))
    expect(byKey.get("anomaly-refunds").insight).toMatch(/Look into your refunds/)
    expect(byKey.get("anomaly-discounts").insight).toMatch(/Review your discounts/)
  })

  it("should stay quiet on a healthy period", () => {
    const out = anomalyFlags(
      {
        range: { gross: 1000, refunds: 10, discounts: 20 },
        trailing: { gross: 4000, refunds: 40, discounts: 80 },
        hourlyRevenue,
      },
      CFG
    )
    expect(out).toEqual([])
  })
})

describe("buildInsights", () => {
  const base = {
    endISO: "2026-09-28T12:00:00.000Z",
    rangeStartISO: "2026-09-28T00:00:00.000Z",
    trailingTxns: [
      { id: "t1", created_at: "2026-09-27T10:00:00+08:00", subtotal: 300, discount: 0, total: 300, status: "COMPLETED", customer_count: 2 },
    ],
    rangeTxns: [
      { id: "t1", created_at: "2026-09-28T10:00:00+08:00", subtotal: 300, discount: 0, total: 300, status: "COMPLETED", customer_count: 2 },
    ],
    trailingRefunds: [],
    rangeRefunds: [],
    trafficRows: [],
    inventory: [{ id: "i1", name: "Milk", stock_quantity: 50 }],
    recipes: [],
    itemRows: [],
    adjustments: [],
    discounts: [],
    products: [],
    windowDays: 28,
  }

  it("should compose shaped insights (single Monday sale)", () => {
    const insights = buildInsights(base, CFG)
    const keys = insights.map((i) => i.key)
    // Sparse sales and absent traffic cannot support a forecast or staffing claim.
    expect(keys).toEqual([])
    expect(keys).not.toContain("all-clear")
    expect(keys).not.toContain("forecast")
    insights.forEach((i) => {
      expect(i).toMatchObject({ key: expect.any(String), metric: expect.any(String), value: expect.any(String), insight: expect.any(String), impact: expect.any(String) })
      expect(Array.isArray(i.numbers)).toBe(true)
    })
  })

  it("should append the calm state when no anomalies fire", () => {
    const hourlyTxns = []
    for (let h = 8; h <= 22; h++) {
      hourlyTxns.push({
        id: `t${h}`, created_at: `2026-09-28T${String(h).padStart(2, "0")}:10:00`,
        subtotal: 100, discount: 2, total: 98, status: "COMPLETED", customer_count: 2,
      })
    }
    const forecastTxns=Array.from({length:28},(_,i)=>({created_at:'2026-09-'+String(i+1).padStart(2,'0')+'T10:00:00+08:00',total:100,status:'COMPLETED'}))
    const insights = buildInsights({ ...base, trailingTxns: hourlyTxns, rangeTxns: hourlyTxns, forecastTxns }, CFG)
    const keys = insights.map((i) => i.key)
    expect(keys).toContain("all-clear")
    expect(keys.some((k) => k.indexOf("anomaly-") === 0)).toBe(false)
    // Calm state settles at the bottom after severity sorting.
    expect(keys[keys.length - 1]).toBe("all-clear")
  })

  it("should return no insights on empty history", () => {
    expect(buildInsights({ ...base, trailingTxns: [], rangeTxns: [] }, CFG)).toEqual([])
  })
})

describe("sortInsightsBySeverity", () => {
  const { sortInsightsBySeverity } = require("../../src/services/insightsService")
  const card = (key, impact) => ({ key, impact })

  it("should order action-now above watch-items above good news", () => {
    const out = sortInsightsBySeverity([
      card("promo", "Positive"),
      card("wastage", "Medium"),
      card("staffing", "High"),
      card("reorder", "Reorder"),
    ], CFG)
    expect(out.map((i) => i.key)).toEqual(["staffing", "reorder", "wastage", "promo"])
  })

  it("should keep composer order within equal rank", () => {
    const out = sortInsightsBySeverity([
      card("b", "Medium"),
      card("a", "Medium"),
    ], CFG)
    expect(out.map((i) => i.key)).toEqual(["b", "a"])
  })

  it("should sort unknown impacts last", () => {
    const out = sortInsightsBySeverity([
      card("mystery", "Critical"),
      card("ok", "Positive"),
    ], CFG)
    expect(out.map((i) => i.key)).toEqual(["ok", "mystery"])
  })

  it("should tolerate empty and non-array input", () => {
    expect(sortInsightsBySeverity([], CFG)).toEqual([])
    expect(sortInsightsBySeverity(null, CFG)).toEqual([])
  })
})

describe("getInsights envelope", () => {
  function stubClient(rowsByTable) {
    return {
      from: (table) => {
        const builder = {}
        for (const m of ["select", "gte", "lte", "order", "eq"]) {
          builder[m] = () => builder
        }
        let start = 0, end = 499
        builder.range = (a, b) => { start = a; end = b; return builder }
        builder.then = (resolve) => {
          return Promise.resolve({ data: (rowsByTable[table] || []).slice(start, end + 1), error: null }).then(resolve)
        }
        return builder
      },
    }
  }

  it("should wrap composed insights with generatedAt, windowDays, and range", async () => {
    const { getInsights } = require("../../src/services/insightsService")
    const client = stubClient({
      transactions: [
        { id: "t1", created_at: "2026-09-27T10:00:00+08:00", subtotal: 300, discount: 0, total: 300, status: "COMPLETED", customer_count: 2 },
      ],
      customer_traffic: [],
      inventory: [{ id: "i1", name: "Milk", stock_quantity: 50 }],
      product_recipes: [],
      inventory_adjustments: [],
      refunds: [],
      discounts: [],
      products: [],
      transaction_items: [],
    })
    const out = await getInsights(
      { start: "2026-09-28T00:00:00.000Z", end: "2026-09-28T12:00:00.000Z", client },
      CFG
    )
    expect(typeof out.generatedAt).toBe("string")
    expect(out.windowDays).toBe(28)
    expect(out.range).toMatchObject({ end: "2026-09-28T12:00:00.000Z" })
    expect(out.insights.map((i) => i.key)).not.toContain("forecast")
  })

  it("should throw a clear error without a configured client", async () => {
    const { getInsights } = require("../../src/services/insightsService")
    await expect(getInsights({ client: null })).rejects.toThrow("Supabase is not configured")
  })
})


describe('analytics read reliability', () => {
  const { readAll, dayKey, hourOf, calendarStart } = require('../../src/services/analyticsReadService')
  const { getInsights, fetchContext } = require('../../src/services/insightsService')
  it('continues after server-shortened pages and includes all records', async () => {
    const source = Array.from({ length: 1207 }, (_, id) => ({ id }))
    const result = await readAll(async (start, end) => ({ data: source.slice(start, Math.min(end + 1, start + 73)) }))
    expect(result).toEqual(source)
  })
  it('rejects partial results when a later page fails', async () => {
    await expect(readAll(async start => start ? { error: { message: 'unavailable' } } : { data: [{ id: 1 }] })).rejects.toMatchObject({ statusCode: 503 })
  })
  it('reports the safety limit instead of returning a truncated total', async () => {
    await expect(readAll(async () => ({ data: [{ id: 1 }] }), { maxRows: 2 })).rejects.toThrow('shorter period')
  })
  it('uses Manila dates and hours across UTC midnight, independent of host timezone', () => {
    expect(dayKey('2026-11-09T16:00:00Z')).toBe('2026-11-10')
    expect(hourOf('2026-11-09T16:00:00Z')).toBe(0)
    expect(calendarStart('2026-11-10').toISOString()).toBe('2026-11-09T16:00:00.000Z')
    expect(calendarStart('2026-02-30')).toBeNull()
  })
  it('does not generate advice when any source is unavailable', async () => {
    const client = { from: () => { const q = {}; for (const method of ['select','gte','lte','order','range','eq']) q[method] = () => q; q.then = resolve => Promise.resolve({ error: { message: 'down' } }).then(resolve); return q } }
    await expect(getInsights({ client })).rejects.toMatchObject({ statusCode: 503 })
  })
  it('bounds sold-item reads on both parent timestamps', async () => {
    const filters = []
    const client = { from: table => { const q = {}; for (const method of ['select','gte','lte','order','range','eq']) q[method] = (...args) => { if (table === 'transaction_items') filters.push([method, ...args]); return q }; q.then = resolve => Promise.resolve({ data: [] }).then(resolve); return q } }
    await fetchContext(client, { spanStart: '2026-11-01T00:00:00Z', end: '2026-11-02T00:00:00Z' })
    expect(filters).toContainEqual(['gte','transactions.created_at','2026-11-01T00:00:00Z'])
    expect(filters).toContainEqual(['lte','transactions.created_at','2026-11-02T00:00:00Z'])
  })
  it('excludes the incomplete anchor day from forecast training without inventing zeros', async () => {
    const client = { from: table => { let offset = 0; const q = {}; for (const method of ['select','gte','lte','order','eq']) q[method] = () => q; q.range = start => { offset = start; return q }; q.then = resolve => Promise.resolve({ data: offset || table !== 'transactions' ? [] : [{ id:'today', created_at:'2026-11-09T10:00:00+08:00', total:500, status:'COMPLETED' }] }).then(resolve); return q } }
    const result = await getInsights({ client, end: '2026-11-09T12:00:00+08:00' })
    expect(result.insights.some(row => row.key === 'forecast')).toBe(false)
    expect(result.dataQuality).toMatchObject({ complete:true, recordingCoverage:'unknown', forecastThrough:'2026-11-08T15:59:59.999Z' })
  })
})


describe('completed historical forecast boundaries', () => {
  it('includes a completed historical end day and starts forecasts on the following day', async () => {
    const { getInsights } = require('../../src/services/insightsService')
    const client = { from: table => { let offset = 0; const q = {}; for (const method of ['select','gte','lte','order','eq']) q[method] = () => q; q.range = start => { offset = start; return q }; q.then = resolve => Promise.resolve({ data: offset || table !== 'transactions' ? [] : Array.from({length:14},(_,i)=>({id:'history-'+i,created_at:new Date(Date.UTC(2026,8,18+i,2)).toISOString(),total:500,status:'COMPLETED'})) }).then(resolve); return q } }
    const result = await getInsights({ client, end:'2026-10-01T23:59:59.999+08:00' })
    expect(result.dataQuality.forecastThrough).toBe('2026-10-01T15:59:59.999Z')
    expect(result.insights.find(row => row.key === 'forecast').detail.days[0].date).toBe('2026-10-02')
  })
})
