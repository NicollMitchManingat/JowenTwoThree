const salesModel = require("../../src/models/salesModel")

describe("Predictive Forecast Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("getSalesForecast()", () => {
    it("should generate a 7-day forecast from mocked sales data", () => {
      vi.spyOn(salesModel, "getSales").mockReturnValue([
        {
          orderId: "ORD-001",
          totalAmount: 100,
          date: "2026-07-01T09:00:00",
        },
        {
          orderId: "ORD-002",
          totalAmount: 200,
          date: "2026-07-02T09:00:00",
        },
        {
          orderId: "ORD-003",
          totalAmount: 300,
          date: "2026-07-03T09:00:00",
        },
      ])

      delete require.cache[
        require.resolve("../../src/services/predictiveForecastService")
      ]

      const {
        getSalesForecast,
      } = require("../../src/services/predictiveForecastService")

      const result = getSalesForecast()

      expect(result).toHaveLength(7)
      expect(result[0].predictedRevenue).toBe(200)
    })

    it("should return an empty array when there are no sales", () => {
      vi.spyOn(salesModel, "getSales").mockReturnValue([])

      delete require.cache[
        require.resolve("../../src/services/predictiveForecastService")
      ]

      const {
        getSalesForecast,
      } = require("../../src/services/predictiveForecastService")

      const result = getSalesForecast()

      expect(result).toEqual([])
    })

    it("should throw an error when sales data is unavailable", () => {
      const {
        getSalesForecast,
      } = require("../../src/services/predictiveForecastService")

      expect(() => {
        getSalesForecast(null)
      }).toThrow("Forecast data is unavailable")
    })

    it("should return forecast objects with date and predictedRevenue", () => {
      vi.spyOn(salesModel, "getSales").mockReturnValue([
        {
          orderId: "ORD-001",
          totalAmount: 100,
          date: "2026-07-01T09:00:00",
        },
      ])

      delete require.cache[
        require.resolve("../../src/services/predictiveForecastService")
      ]

      const {
        getSalesForecast,
      } = require("../../src/services/predictiveForecastService")

      const result = getSalesForecast()

      expect(result[0]).toHaveProperty("date")
      expect(result[0]).toHaveProperty("predictedRevenue")
    })

    it("should always generate seven forecast records", () => {
      vi.spyOn(salesModel, "getSales").mockReturnValue([
        {
          orderId: "ORD-001",
          totalAmount: 100,
          date: "2026-07-01T09:00:00",
        },
      ])

      delete require.cache[
        require.resolve("../../src/services/predictiveForecastService")
      ]

      const {
        getSalesForecast,
      } = require("../../src/services/predictiveForecastService")

      const result = getSalesForecast()

      expect(result).toHaveLength(7)
    })
  })
})