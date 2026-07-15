const {
  getSalesTrendData,
} = require("../../src/services/salesTrendService")

describe("Sales Trend Service", () => {
  describe("getSalesTrendData()", () => {
    it("should aggregate mock revenue by date", () => {
      const mockSales = [
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
      ]

      const result = getSalesTrendData(mockSales)

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
      const result = getSalesTrendData()

      expect(result).toEqual([
        {
          date: "2026-07-01",
          revenue: 4908,
        },
      ])
    })

    it("should return an empty array when sales data is empty", () => {
      const result = getSalesTrendData([])

      expect(result).toEqual([])
    })

    it("should throw an error when sales data is invalid", () => {
      expect(() => {
        getSalesTrendData(null)
      }).toThrow("Sales data is unavailable")
    })

    it("should return objects with date and revenue properties", () => {
      const result = getSalesTrendData()

      expect(result[0]).toHaveProperty("date")
      expect(result[0]).toHaveProperty("revenue")
    })
  })
})