const { getSalesData } = require("../../src/services/salesService")

describe("Sales Service", () => {
  describe("getSalesData()", () => {
    it("should return actual sales data", () => {
      const data = getSalesData()

      expect(data).toHaveProperty("summary")
      expect(data).toHaveProperty("records")
      expect(Array.isArray(data.records)).toBe(true)
    })

    it("should merge inventory information", () => {
      const data = getSalesData()

      expect(data.records[0]).toHaveProperty("inventory")
      expect(data.records[0].inventory).toHaveProperty("category")
      expect(data.records[0].inventory).toHaveProperty("inStock")
      expect(data.records[0].inventory).toHaveProperty("status")
    })

    it("should compute summary correctly", () => {
      const data = getSalesData()

      expect(data.summary.totalOrders).toBe(3)
      expect(data.summary.totalItemsSold).toBe(40)
      expect(data.summary.totalSales).toBe(4908)
    })

    it("should work with mock sales data", () => {
      const mockSales = [
        {
          orderId: "ORD-100",
          itemId: "I-001",
          itemName: "Chicken Burger",
          quantitySold: 5,
          totalAmount: 745,
          date: "2026-07-02",
        },
      ]

      const mockInventory = [
        {
          id: "I-001",
          category: "Meals",
          inStock: 25,
          status: "Good",
        },
      ]

      const data = getSalesData(mockSales, mockInventory)

      expect(data.summary.totalOrders).toBe(1)
      expect(data.summary.totalItemsSold).toBe(5)
      expect(data.summary.totalSales).toBe(745)
      expect(data.records[0].inventory.category).toBe("Meals")
    })

    it("should throw an error when sales data is invalid", () => {
      expect(() => {
        getSalesData(null, [])
      }).toThrow("Sales data is unavailable")
    })

    it("should throw an error when inventory data is invalid", () => {
      expect(() => {
        getSalesData([], null)
      }).toThrow("Inventory data is unavailable")
    })
  })
})