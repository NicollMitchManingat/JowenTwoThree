const request = require("supertest")

const app = require("../../src/app")

const predictiveForecastService = require("../../src/services/predictiveForecastService")

describe("Predictive Forecast Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /api/predictive-forecast", () => {
    it("should return forecast data when data exists", async () => {
      vi.spyOn(
        predictiveForecastService,
        "getSalesForecast"
      ).mockReturnValue([
        {
          date: "2026-07-04",
          predictedRevenue: 250,
        },
        {
          date: "2026-07-05",
          predictedRevenue: 250,
        },
      ])

      const res = await request(app).get("/api/predictive-forecast")

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([
        {
          date: "2026-07-04",
          predictedRevenue: 250,
        },
        {
          date: "2026-07-05",
          predictedRevenue: 250,
        },
      ])
    })

    it("should return an empty forecast array when no data exists", async () => {
      vi.spyOn(
        predictiveForecastService,
        "getSalesForecast"
      ).mockReturnValue([])

      const res = await request(app).get("/api/predictive-forecast")

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })

    it("should return HTTP 500 when the service throws an error", async () => {
      vi.spyOn(
        predictiveForecastService,
        "getSalesForecast"
      ).mockImplementation(() => {
        throw new Error("Forecast data is unavailable")
      })

      const res = await request(app).get("/api/predictive-forecast")

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: "Forecast data is unavailable",
      })
    })

    it("should return forecast objects with date and predictedRevenue", async () => {
      vi.spyOn(
        predictiveForecastService,
        "getSalesForecast"
      ).mockReturnValue([
        {
          date: "2026-07-04",
          predictedRevenue: 250,
        },
      ])

      const res = await request(app).get("/api/predictive-forecast")

      expect(res.body.data[0]).toHaveProperty("date")
      expect(res.body.data[0]).toHaveProperty("predictedRevenue")
    })

    it("should return seven forecast records", async () => {
      const forecast = Array.from({ length: 7 }, (_, i) => ({
        date: `2026-07-${String(i + 4).padStart(2, "0")}`,
        predictedRevenue: 250,
      }))

      vi.spyOn(
        predictiveForecastService,
        "getSalesForecast"
      ).mockReturnValue(forecast)

      const res = await request(app).get("/api/predictive-forecast")

      expect(res.body.data).toHaveLength(7)
    })
  })
})