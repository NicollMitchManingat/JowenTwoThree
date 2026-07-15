const request = require("supertest")
const app = require("../../src/app")

describe("Sales Trend Route", () => {
  describe("GET /api/sales/trend", () => {
    it("should return HTTP status 200", async () => {
      const res = await request(app).get("/api/sales/trend")

      expect(res.status).toBe(200)
    })

    it("should return JSON response", async () => {
      const res = await request(app).get("/api/sales/trend")

      expect(res.headers["content-type"]).toMatch(/json/)
    })

    it("should return trend data", async () => {
      const res = await request(app).get("/api/sales/trend")

      expect(res.body).toHaveProperty("data")
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it("should return revenue for each date", async () => {
      const res = await request(app).get("/api/sales/trend")

      expect(res.body.data[0]).toHaveProperty("date")
      expect(res.body.data[0]).toHaveProperty("revenue")
    })

    it("should return at least one revenue record", async () => {
      const res = await request(app).get("/api/sales/trend")

      expect(res.body.data.length).toBeGreaterThan(0)
    })
  })
})