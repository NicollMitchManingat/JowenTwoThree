const {
  getCustomerTrafficData,
} = require("../../src/services/customerTrafficService")

describe("Customer Traffic Service", () => {
  describe("getCustomerTrafficData()", () => {
    it("should return 24 hourly bins", () => {
      const result = getCustomerTrafficData([])

      expect(result).toHaveLength(24)
      expect(result[0]).toHaveProperty("hour")
      expect(result[0]).toHaveProperty("count")
    })

    it("should correctly group mock transactions by hour", () => {
      const mockSales = [
        {
          orderId: "ORD-001",
          date: "2026-07-01T09:15:00",
        },
        {
          orderId: "ORD-002",
          date: "2026-07-01T09:45:00",
        },
        {
          orderId: "ORD-003",
          date: "2026-07-01T13:20:00",
        },
        {
          orderId: "ORD-004",
          date: "2026-07-01T13:55:00",
        },
        {
          orderId: "ORD-005",
          date: "2026-07-01T20:30:00",
        },
      ]

      const result = getCustomerTrafficData(mockSales)

      expect(result[9].count).toBe(2)
      expect(result[13].count).toBe(2)
      expect(result[20].count).toBe(1)
    })

    it("should ignore invalid timestamps", () => {
      const mockSales = [
        {
          orderId: "ORD-001",
          date: "invalid-date",
        },
      ]

      const result = getCustomerTrafficData(mockSales)

      expect(result.every((hour) => hour.count === 0)).toBe(true)
    })

    it("should return actual customer traffic data", () => {
      const result = getCustomerTrafficData()

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(24)
    })

    it("should throw an error when sales data is invalid", () => {
      expect(() => {
        getCustomerTrafficData(null)
      }).toThrow("Sales data is unavailable")
    })
  })
})