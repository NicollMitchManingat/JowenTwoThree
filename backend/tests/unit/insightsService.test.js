const {
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
  fmtPeso,
  fmtHour,
} = require("../../src/services/insightsService")

const CFG = {
  TRAILING_DAYS: 28,
  SAME_WEEKDAY_OCCURRENCES: 4,
  FORECAST_DAYS: 7,
  REORDER_COVER_DAYS: 7,
  REORDER_TOP_N: 3,
  STAFFING_CONVERSION: 0.4,
  STAFFING_PEAK_MULT: 1.5,
  WASTAGE_REASONS: ["spoiled", "expired", "damaged"],
  WASTAGE_SHARE: 0.15,
  REFUND_MULT: 2,
  REFUND_MIN_RATE: 5,
  DISCOUNT_CREEP_PTS: 5,
  TRADING_START_HOUR: 8,
  TRADING_END_HOUR: 22,
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
      { id: "t1", created_at: "2026-09-07T10:00:00", total: 300, status: "COMPLETED" },
      { id: "t4", created_at: "2026-09-07T11:00:00", total: 150, status: "REFUNDED" },
    ]
    const refunds = [
      { transaction_id: "t4", refund_amount: 150, created_at: "2026-09-07T12:00:00" },
      { transaction_id: "t1", refund_amount: 40, created_at: "2026-09-08T09:00:00" },
    ]
    const daily = netDailySales(txns, refunds)
    // t4 excluded and its refund skipped; the t1 refund lands on its own
    // date and clamps at zero (same cash-basis rule as the dashboard).
    expect(daily["2026-09-07"]).toBe(300)
    expect(daily["2026-09-08"]).toBe(0)
  })

  it("trafficBins should split buyers and walk-ins per hour", () => {
    const { hourly, split } = trafficBins(
      [{ created_at: "2026-09-07T12:10:00", customer_count: 2 }],
      [{ created_at: "2026-09-07T12:40:00", number_of_customer: 5 }]
    )
    expect(hourly).toHaveLength(24)
    expect(hourly[12]).toMatchObject({ hour: 12, buyers: 1, walkIns: 5, customers: 7 })
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

describe("forecastDemand", () => {
  // Four Mondays + overall mean fallback.
  const daily = {
    "2026-09-07": 100, "2026-09-14": 200, "2026-09-21": 300, "2026-09-28": 400,
    "2026-09-08": 50,
  }

  it("should average same weekdays over trend history", () => {
    // End date 2026-09-28 is a Monday: days[0] is Tuesday 09-29 (history:
    // one Tuesday at 50), days[6] is Monday 10-05 (four Mondays avg 250).
    const out = forecastDemand(daily, "2026-09-28T12:00:00", CFG)
    expect(out.key).toBe("forecast")
    expect(out.detail.days).toHaveLength(7)
    expect(out.detail.days[0]).toMatchObject({ date: "2026-09-29", revenue: 50 })
    expect(out.detail.days[6]).toMatchObject({ date: "2026-10-05", revenue: 250 })
    expect(out.detail.total).toBe(out.detail.days.reduce((s, d) => s + d.revenue, 0))
    expect(out.numbers).toContain(out.detail.total)
  })

  it("should fall back to the overall mean for unseen weekdays", () => {
    const out = forecastDemand({ "2026-09-07": 100 }, "2026-09-07T12:00:00", CFG)
    // Tuesday has no history → overall mean 100.
    expect(out.detail.days[0]).toMatchObject({ date: "2026-09-08", revenue: 100 })
  })

  it("should suppress the forecast on empty history", () => {
    expect(forecastDemand({}, "2026-09-28T12:00:00", CFG)).toBe(null)
    expect(forecastDemand({ "2026-09-07": 0 }, "2026-09-07T12:00:00", CFG)).toBe(null)
  })
})

describe("peakStaffing", () => {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, customers: 4 }))
  hourly[12] = { hour: 12, customers: 20 }
  hourly[13] = { hour: 13, customers: 18 }
  const split = Array.from({ length: 24 }, (_, hour) => ({ hour, walkIns: 4, buyers: 1 }))
  split[12] = { hour: 12, walkIns: 10, buyers: 8 }

  it("should flag a high-converting peak hour", () => {
    const out = peakStaffing(hourly, split, CFG)
    expect(out.key).toBe("staffing")
    expect(out.impact).toBe("High")
    expect(out.value).toContain("12 PM")
    expect(out.insight).toMatch(/extra staff/)
  })

  it("should stay quiet without a converting peak", () => {
    const flat = Array.from({ length: 24 }, (_, hour) => ({ hour, customers: 4 }))
    expect(peakStaffing(flat, split, CFG)).toBe(null)
    expect(peakStaffing([], [], CFG)).toBe(null)
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

  it("should flag refund spikes, dead hours, and discount creep independently", () => {
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
    // Refund rate 20% vs trailing 2.5% (8x) → spike; 9 AM dead; discounts 20% vs 5% (+15pts).
    expect(keys).toEqual(expect.arrayContaining(["anomaly-refunds", "anomaly-hours", "anomaly-discounts"]))
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
      { id: "t1", created_at: "2026-09-28T10:00:00", subtotal: 300, discount: 0, total: 300, status: "COMPLETED", customer_count: 2 },
    ],
    rangeTxns: [
      { id: "t1", created_at: "2026-09-28T10:00:00", subtotal: 300, discount: 0, total: 300, status: "COMPLETED", customer_count: 2 },
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
    // Single Monday sale: forecast fires, single-buyer hour staffs,
    // every other trading hour reads dead → no all-clear.
    expect(keys).toEqual(expect.arrayContaining(["forecast", "staffing", "anomaly-hours"]))
    expect(keys).not.toContain("all-clear")
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
    const insights = buildInsights({ ...base, trailingTxns: hourlyTxns, rangeTxns: hourlyTxns }, CFG)
    const keys = insights.map((i) => i.key)
    expect(keys).toContain("all-clear")
    expect(keys.some((k) => k.indexOf("anomaly-") === 0)).toBe(false)
  })

  it("should return no insights on empty history", () => {
    expect(buildInsights({ ...base, trailingTxns: [], rangeTxns: [] }, CFG)).toEqual([])
  })
})

describe("getInsights envelope", () => {
  function stubClient(rowsByTable) {
    return {
      from: (table) => {
        const builder = {}
        for (const m of ["select", "gte", "lte", "order", "range"]) {
          builder[m] = () => builder
        }
        builder.then = (resolve) => {
          return Promise.resolve({ data: rowsByTable[table] || [], error: null }).then(resolve)
        }
        return builder
      },
    }
  }

  it("should wrap composed insights with generatedAt, windowDays, and range", async () => {
    const { getInsights } = require("../../src/services/insightsService")
    const client = stubClient({
      transactions: [
        { id: "t1", created_at: "2026-09-28T10:00:00", subtotal: 300, discount: 0, total: 300, status: "COMPLETED", customer_count: 2 },
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
    expect(out.insights.map((i) => i.key)).toContain("forecast")
  })

  it("should throw a clear error without a configured client", async () => {
    const { getInsights } = require("../../src/services/insightsService")
    await expect(getInsights({ client: null })).rejects.toThrow("Supabase is not configured")
  })
})
