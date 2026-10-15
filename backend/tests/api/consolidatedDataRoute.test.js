const request = require("supertest")
const app = require("../../src/app")

describe("Consolidated Data Route", () => {
  describe("GET /api/consolidated-data", () => {
    it("should return HTTP status 200", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(res.status).toBe(200)
    })

    it("should return JSON data", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(res.headers["content-type"]).toMatch(/json/)
    })

    it("should return a data object", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(res.body).toHaveProperty("data")
    })

    it("should return a summary with revenue, units, and customer fields", async () => {
      const res = await request(app).get("/api/consolidated-data")
      const { summary } = res.body.data

      expect(summary).toHaveProperty("totalRevenue")
      expect(summary).toHaveProperty("grossRevenue")
      expect(summary).toHaveProperty("totalRefunded")
      expect(summary).toHaveProperty("totalUnitsSold")
      expect(summary).toHaveProperty("totalCustomers")
      expect(summary).toHaveProperty("totalTransactions")
      expect(summary).toHaveProperty("avgTicket")
      expect(summary).toHaveProperty("totalInventoryItems")
      // Gross − Refunded = Net holds regardless of live or mock data.
      expect(summary.totalRevenue).toBe(summary.grossRevenue - summary.totalRefunded)
    })

    it("should return rows array", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(Array.isArray(res.body.data.rows)).toBe(true)
      expect(res.body.data.rows.length).toBeGreaterThan(0)
    })

    it("should return each row with all required columns", async () => {
      const res = await request(app).get("/api/consolidated-data")

      res.body.data.rows.forEach((row) => {
        expect(row).toHaveProperty("date")
        expect(row).toHaveProperty("orderId")
        expect(row).toHaveProperty("itemName")
        expect(row).toHaveProperty("category")
        expect(row).toHaveProperty("quantitySold")
        expect(row).toHaveProperty("totalAmount")
        expect(row).toHaveProperty("refunded")
        expect(row).toHaveProperty("status")
        expect(row).toHaveProperty("inStock")
        expect(row).toHaveProperty("inventoryStatus")
      })
    })

    it("should return per-category rollups", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(Array.isArray(res.body.data.categories)).toBe(true)
      res.body.data.categories.forEach((cat) => {
        expect(cat).toHaveProperty("name")
        expect(cat).toHaveProperty("revenue")
        expect(cat).toHaveProperty("units")
        expect(cat).toHaveProperty("transactions")
      })
    })

    it("should report its data source in meta", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(res.body.data.meta).toHaveProperty("dataSource")
      expect(["live", "cart", "mock"]).toContain(res.body.data.meta.dataSource)
    })

    it("should accept date filters and echo them in meta", async () => {
      const res = await request(app)
        .get("/api/consolidated-data?from=2026-10-01&to=2026-10-31")

      expect(res.status).toBe(200)
      expect(res.body.data.meta.from).toBe("2026-10-01")
      expect(res.body.data.meta.to).toBe("2026-10-31")
    })

    it("should reject invalid date filters with a 400", async () => {
      const res = await request(app).get("/api/consolidated-data?from=not-a-date")

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("error")
    })

    it("should return salesByItem", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(Array.isArray(res.body.data.salesByItem)).toBe(true)
    })

    it("should return trafficByHour with 24 entries", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(res.body.data.trafficByHour.length).toBe(24)
    })
  })
})
