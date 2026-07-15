const request = require("supertest")
const app = require("../../src/app")

describe("Customer Traffic Route", () => {
  describe("GET /api/customer-traffic", () => {
    it("should return HTTP status 200", async () => {
      const res = await request(app).get("/api/customer-traffic")

      expect(res.status).toBe(200)
    })

    it("should return JSON response", async () => {
      const res = await request(app).get("/api/customer-traffic")

      expect(res.headers["content-type"]).toMatch(/json/)
    })

    it("should return customer traffic data", async () => {
      const res = await request(app).get("/api/customer-traffic")

      expect(res.body).toHaveProperty("data")
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it("should return 24 hourly bins", async () => {
      const res = await request(app).get("/api/customer-traffic")

      expect(res.body.data).toHaveLength(24)
    })

    it("should return hour and count properties", async () => {
      const res = await request(app).get("/api/customer-traffic")

      expect(res.body.data[0]).toHaveProperty("hour")
      expect(res.body.data[0]).toHaveProperty("count")
    })
  })
})