const salesModel = require("../../src/models/salesModel")
const {
  getSalesTrendData,
} = require("../../src/services/salesTrendService")

describe("Sales Trend Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("getSalesTrendData()", () => {
    it("should aggregate revenue from mocked sales data", () => {
      vi.spyOn(salesModel, "getSales").mockReturnValue([
        {
          orderId: "ORD-001",
          totalAmount: 100,
          date: "2026-07-01T09:00:00",
        },
        {
          orderId: "ORD-002",
          totalAmount: 200,
          date: "2026-07-01T10:30:00",
        },
        {
          orderId: "ORD-003",
          totalAmount: 150,
          date: "2026-07-02T08:00:00",
        },
      ])

      const result = getSalesTrendData()

      expect(salesModel.getSales).toHaveBeenCalledTimes(1)

      expect(result).toEqual([
        {
          date: "2026-07-01",
          revenue: 300,
        },
        {
          date: "2026-07-02",
          revenue: 150,
        },
      ])
    })

    it("should return aggregated revenue from actual sales data", () => {
      vi.restoreAllMocks()

      const result = getSalesTrendData()

      expect(result).toEqual([
        {
          date: "2026-07-01",
          revenue: 4908,
        },
      ])
    })

    it("should return an empty array when no sales data exists", () => {
      vi.spyOn(salesModel, "getSales").mockReturnValue([])

      const result = getSalesTrendData()

      expect(salesModel.getSales).toHaveBeenCalledTimes(1)
      expect(result).toEqual([])
    })

    it("should throw an error when the model returns invalid data", () => {
      vi.spyOn(salesModel, "getSales").mockReturnValue(null)

      expect(() => getSalesTrendData()).toThrow(
        "Sales data is unavailable"
      )

      expect(salesModel.getSales).toHaveBeenCalledTimes(1)
    })

    it("should return objects with date and revenue properties", () => {
      vi.restoreAllMocks()

      const result = getSalesTrendData()

      expect(result[0]).toHaveProperty("date")
      expect(result[0]).toHaveProperty("revenue")
    })
  })
})