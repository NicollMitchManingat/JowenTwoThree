const {
  getConsolidatedData,
  summarize,
  applyCategoryFilter,
} = require("../../src/services/consolidatedDataService")

// Minimal chainable Supabase fake: supports the select/gte/lt/in/order/limit
// chain used by the service and resolves like a real query result.
function makeSupabase({ transactions = [], items = [], refunds = [], errorOn = null } = {}) {
  const sources = {
    transactions,
    transaction_items: items,
    refunds,
  }
  const from = (name) => {
    const q = {
      _filters: [],
      select() { return q },
      gte(col, val) { q._filters.push(["gte", col, val]); return q },
      lt(col, val) { q._filters.push(["lt", col, val]); return q },
      in(col, vals) { q._filters.push(["in", col, vals]); return q },
      order() { return q },
      limit() { return q },
      then(resolve) {
        if (errorOn === name || errorOn === "all") {
          resolve({ data: null, error: { message: "boom" } })
          return
        }
        let rows = sources[name] || []
        q._filters.forEach(([op, col, val]) => {
          if (op === "in") rows = rows.filter((r) => val.includes(r[col]))
          if (op === "gte") rows = rows.filter((r) => String(r[col]) >= String(val))
          if (op === "lt") rows = rows.filter((r) => String(r[col]) < String(val))
        })
        resolve({ data: rows, error: null })
      },
    }
    return q
  }
  return { from }
}

const inventoryStub = () => Promise.resolve([
  { id: "inv-1", name: "Chicken Burger", category: "Meals", inStock: 25, status: "Good" },
  { id: "inv-2", name: "Milk", category: "Dairy", inStock: 10, status: "Low" },
])

const liveTransactions = [
  {
    id: "t-1",
    transaction_number: "TXN-001",
    created_at: "2026-10-10T10:00:00.000Z",
    customer_count: 2,
    status: "COMPLETED",
    total: 450,
    cart: [],
  },
  {
    id: "t-2",
    transaction_number: "TXN-002",
    created_at: "2026-10-11T12:00:00.000Z",
    customer_count: 1,
    status: "REFUNDED",
    total: 300,
    cart: [],
  },
]

const liveItems = [
  {
    transaction_id: "t-1",
    quantity: 3,
    unit_price: 150,
    subtotal: 450,
    products: { product_name: "Chicken Burger", product_categories: { name: "Meals" } },
  },
  {
    transaction_id: "t-2",
    quantity: 2,
    unit_price: 150,
    subtotal: 300,
    products: { product_name: "Chicken Burger", product_categories: { name: "Meals" } },
  },
]

describe("Consolidated Data Service (real-data rewrite)", () => {
  describe("live transaction_items path", () => {
    it("builds rows joined to products with stock cross-reference", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.meta.dataSource).toBe("live")
      const saleRows = data.rows.filter((r) => r.orderId !== "N/A")
      expect(saleRows).toHaveLength(2)
      expect(saleRows[0]).toMatchObject({
        orderId: "TXN-001",
        itemName: "Chicken Burger",
        category: "Meals",
        quantitySold: 3,
        totalAmount: 450,
        inStock: 25,
        inventoryStatus: "Good",
      })
    })

    it("excludes REFUNDED transactions from net revenue but counts the refund", async () => {
      const supabase = makeSupabase({
        transactions: liveTransactions,
        items: liveItems,
        refunds: [{ transaction_id: "t-2", refund_amount: 300 }],
      })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.summary.grossRevenue).toBe(750)
      expect(data.summary.totalRefunded).toBe(300)
      expect(data.summary.totalRevenue).toBe(450)
      expect(data.summary.totalUnitsSold).toBe(3)
      expect(data.summary.totalCustomers).toBe(2)
      expect(data.summary.totalTransactions).toBe(2)
    })

    it("falls back to full total when a REFUNDED txn has no refund rows", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.summary.totalRefunded).toBe(300)
      expect(data.summary.totalRevenue).toBe(450)
    })

    it("rolls up per-category revenue", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.categories).toEqual([
        { name: "Meals", revenue: 450, units: 3, transactions: 2 },
      ])
    })

    it("appends unsold inventory as zero rows", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      const milk = data.rows.find((r) => r.itemName === "Milk")
      expect(milk).toMatchObject({ orderId: "N/A", quantitySold: 0, totalAmount: 0 })
    })

    it("returns 24-bucket traffic hours", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.trafficByHour).toHaveLength(24)
      const expectedHour = new Date("2026-10-10T10:00:00.000Z").getHours()
      expect(data.trafficByHour.find((b) => b.hour === expectedHour).customers).toBe(1)
    })
  })

  describe("cart JSONB fallback", () => {
    it("expands cart lines when item rows are missing", async () => {
      const txns = [
        {
          id: "t-9",
          transaction_number: "TXN-009",
          created_at: "2026-10-12T09:00:00.000Z",
          customer_count: 3,
          status: "COMPLETED",
          total: 500,
          cart: [{ name: "Latte", qty: 2, price: 250 }],
        },
      ]
      const supabase = makeSupabase({ transactions: txns, items: [] })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.meta.dataSource).toBe("cart")
      expect(data.rows[0]).toMatchObject({
        orderId: "TXN-009",
        itemName: "Latte",
        quantitySold: 2,
        totalAmount: 500,
      })
      expect(data.summary.totalRevenue).toBe(500)
      expect(data.summary.totalCustomers).toBe(3)
    })
  })

  describe("filters", () => {
    it("narrows by date range", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData(
        { from: "2026-10-11", to: "2026-10-11" },
        { supabase, fetchInventory: inventoryStub }
      )

      const saleRows = data.rows.filter((r) => r.orderId !== "N/A")
      expect(saleRows.map((r) => r.orderId)).toEqual(["TXN-002"])
      expect(data.meta.from).toBe("2026-10-11")
      expect(data.meta.to).toBe("2026-10-11")
    })

    it("narrows by category", async () => {
      const supabase = makeSupabase({ transactions: liveTransactions, items: liveItems })
      const data = await getConsolidatedData(
        { category: "Beverage" },
        { supabase, fetchInventory: inventoryStub }
      )

      expect(data.rows.filter((r) => r.orderId !== "N/A")).toHaveLength(0)
      expect(data.meta.category).toBe("Beverage")
    })

    it("rejects invalid dates with a 400", async () => {
      await expect(
        getConsolidatedData({ from: "not-a-date" }, { supabase: makeSupabase({}), fetchInventory: inventoryStub })
      ).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe("mock fallback", () => {
    it("uses bundled mocks when Supabase is unavailable", async () => {
      const data = await getConsolidatedData({}, { supabase: null, fetchInventory: () => Promise.reject(new Error("down")) })

      expect(data.meta.dataSource).toBe("mock")
      expect(data.summary.totalRevenue).toBe(4908)
      expect(data.summary.totalUnitsSold).toBe(40)
      expect(data.summary.totalCustomers).toBe(5)
      expect(data.summary.totalInventoryItems).toBe(2)
      expect(data.trafficByHour).toHaveLength(24)
      data.rows.forEach((row) => {
        expect(row).toHaveProperty("inventoryStatus")
      })
    })

    it("uses mocks when live queries fail", async () => {
      const supabase = makeSupabase({ errorOn: "all" })
      const data = await getConsolidatedData({}, { supabase, fetchInventory: inventoryStub })

      expect(data.meta.dataSource).toBe("mock")
      expect(data.rows.length).toBeGreaterThan(0)
    })
  })

  describe("summarize()", () => {
    it("nets partial refunds and skips refunded rows", () => {
      const { summary } = summarize(
        [
          { orderId: "A", category: "Meals", quantitySold: 2, totalAmount: 400, refunded: 50, status: "COMPLETED" },
          { orderId: "B", category: "Meals", quantitySold: 1, totalAmount: 300, refunded: 300, status: "REFUNDED" },
          { orderId: "N/A", category: "Dairy", quantitySold: 0, totalAmount: 0, refunded: 0, status: "N/A" },
        ],
        [
          { transaction_number: "A", customer_count: 2, status: "COMPLETED" },
          { transaction_number: "B", customer_count: 1, status: "REFUNDED" },
        ]
      )

      expect(summary.totalRevenue).toBe(350)
      expect(summary.totalRefunded).toBe(350)
      expect(summary.totalUnitsSold).toBe(2)
      expect(summary.totalCustomers).toBe(2)
      expect(summary.avgTicket).toBe(350)
    })
  })

  describe("applyCategoryFilter()", () => {
    it("matches case-insensitively and passes through when blank", () => {
      const rows = [{ category: "Meals" }, { category: "Beverage" }]
      expect(applyCategoryFilter(rows, "meals")).toEqual([{ category: "Meals" }])
      expect(applyCategoryFilter(rows, "")).toHaveLength(2)
      expect(applyCategoryFilter(rows, undefined)).toHaveLength(2)
    })
  })
})
