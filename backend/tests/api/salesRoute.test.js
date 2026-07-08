const request = require("supertest")
const app = require("../../src/app")

describe("Sales Route", () => {
  describe("GET /api/sales", () => {
    it("should return HTTP status 200", async () => {
      const res = await request(app).get("/api/sales")

      expect(res.status).toBe(200)
    })

    it("should return JSON data", async () => {
      const res = await request(app).get("/api/sales")

      expect(res.headers["content-type"]).toMatch(/json/)
    })

    it("should return a data object", async () => {
      const res = await request(app).get("/api/sales")

      expect(res.body).toHaveProperty("data")
    })

    it("should return a summary object", async () => {
      const res = await request(app).get("/api/sales")

      expect(res.body.data).toHaveProperty("summary")
    })

    it("should return merged sales records", async () => {
      const res = await request(app).get("/api/sales")

      expect(Array.isArray(res.body.data.records)).toBe(true)
      expect(res.body.data.records.length).toBeGreaterThan(0)
    })

    it("should include inventory information", async () => {
      const res = await request(app).get("/api/sales")

      expect(res.body.data.records[0]).toHaveProperty("inventory")
      expect(res.body.data.records[0].inventory).toHaveProperty("category")
      expect(res.body.data.records[0].inventory).toHaveProperty("inStock")
      expect(res.body.data.records[0].inventory).toHaveProperty("status")
    })
  })
})