const request = require("supertest")

const salesTrendService = require("../../src/services/salesTrendService")
const app = require("../../src/app")

describe("Sales Trend Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /api/sales/trend", () => {
    it("should return sales trend data when data exists", async () => {
      vi.spyOn(salesTrendService, "getSalesTrendData").mockReturnValue([
        {
          date: "2026-07-01",
          revenue: 4908,
        },
      ])

      const res = await request(app).get("/api/sales/trend")

      expect(salesTrendService.getSalesTrendData).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(200)
      expect(res.headers["content-type"]).toMatch(/json/)
      expect(res.body).toEqual({
        data: [
          {
            date: "2026-07-01",
            revenue: 4908,
          },
        ],
      })
    })

    it("should return an empty array when no data exists", async () => {
      vi.spyOn(salesTrendService, "getSalesTrendData").mockReturnValue([])

      const res = await request(app).get("/api/sales/trend")

      expect(salesTrendService.getSalesTrendData).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        data: [],
      })
    })

    it("should return HTTP 500 when the service throws an error", async () => {
      vi.spyOn(salesTrendService, "getSalesTrendData").mockImplementation(() => {
        throw new Error("Sales data is unavailable")
      })

      const res = await request(app).get("/api/sales/trend")

      expect(salesTrendService.getSalesTrendData).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: "Sales data is unavailable",
      })
    })

    it("should return revenue for each date", async () => {
      vi.spyOn(salesTrendService, "getSalesTrendData").mockReturnValue([
        {
          date: "2026-07-01",
          revenue: 4908,
        },
      ])

      const res = await request(app).get("/api/sales/trend")

      expect(res.body.data[0]).toHaveProperty("date")
      expect(res.body.data[0]).toHaveProperty("revenue")
    })

    it("should return at least one revenue record", async () => {
      vi.spyOn(salesTrendService, "getSalesTrendData").mockReturnValue([
        {
          date: "2026-07-01",
          revenue: 4908,
        },
      ])

      const res = await request(app).get("/api/sales/trend")

      expect(res.body.data.length).toBeGreaterThan(0)
    })
  })
})