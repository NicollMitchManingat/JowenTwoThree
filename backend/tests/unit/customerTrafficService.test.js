const customerTrafficModel = require("../../src/models/customerTrafficModel")
const {
  getCustomerTrafficData,
} = require("../../src/services/customerTrafficService")

describe("Customer Traffic Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("getCustomerTrafficData()", () => {
    it("should group mocked customer traffic into hourly bins", () => {
      vi.spyOn(customerTrafficModel, "getCustomerTraffic").mockReturnValue([
        {
          orderId: "ORD-001",
          timestamp: "2026-07-01T09:15:00",
        },
        {
          orderId: "ORD-002",
          timestamp: "2026-07-01T09:45:00",
        },
        {
          orderId: "ORD-003",
          timestamp: "2026-07-01T10:30:00",
        },
      ])

      const result = getCustomerTrafficData()

      expect(customerTrafficModel.getCustomerTraffic).toHaveBeenCalledTimes(1)

      expect(result.find((item) => item.hour === 9).customers).toBe(2)
      expect(result.find((item) => item.hour === 10).customers).toBe(1)
    })

    it("should return grouped customer traffic from actual model data", () => {
      vi.restoreAllMocks()

      const result = getCustomerTrafficData()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(24)
    })

    it("should return zero customers for all hours when no data exists", () => {
      vi.spyOn(customerTrafficModel, "getCustomerTraffic").mockReturnValue([])

      const result = getCustomerTrafficData()

      expect(customerTrafficModel.getCustomerTraffic).toHaveBeenCalledTimes(1)

      result.forEach((hour) => {
        expect(hour.customers).toBe(0)
      })
    })

    it("should throw an error when the model returns invalid data", () => {
      vi.spyOn(customerTrafficModel, "getCustomerTraffic").mockReturnValue(null)

      expect(() => {
        getCustomerTrafficData()
      }).toThrow("Customer traffic data is unavailable")

      expect(customerTrafficModel.getCustomerTraffic).toHaveBeenCalledTimes(1)
    })

    it("should return objects with hour and customers properties", () => {
      vi.restoreAllMocks()

      const result = getCustomerTrafficData()

      expect(result[0]).toHaveProperty("hour")
      expect(result[0]).toHaveProperty("customers")
    })
  })
})