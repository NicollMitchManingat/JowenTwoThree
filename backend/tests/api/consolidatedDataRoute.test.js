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

    it("should return summary with totalRevenue", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(res.body.data.summary).toHaveProperty("totalRevenue")
      expect(res.body.data.summary.totalRevenue).toBe(4908)
    })

    it("should return summary with totalUnitsSold", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(res.body.data.summary.totalUnitsSold).toBe(40)
    })

    it("should return summary with totalCustomers", async () => {
      const res = await request(app).get("/api/consolidated-data")

      expect(res.body.data.summary.totalCustomers).toBe(5)
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
        expect(row).toHaveProperty("inStock")
        expect(row).toHaveProperty("inventoryStatus")
      })
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
