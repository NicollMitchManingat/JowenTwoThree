const { getConsolidatedData } = require("../../src/services/consolidatedDataService")

describe("Consolidated Data Service", () => {
  describe("getConsolidatedData()", () => {
    it("should return a summary object with required fields", () => {
      const data = getConsolidatedData()

      expect(data).toHaveProperty("summary")
      expect(data.summary).toHaveProperty("totalRevenue")
      expect(data.summary).toHaveProperty("totalUnitsSold")
      expect(data.summary).toHaveProperty("totalCustomers")
      expect(data.summary).toHaveProperty("totalInventoryItems")
    })

    it("should compute total revenue from sales data", () => {
      const data = getConsolidatedData()

      expect(data.summary.totalRevenue).toBe(4908)
    })

    it("should compute total units sold", () => {
      const data = getConsolidatedData()

      expect(data.summary.totalUnitsSold).toBe(40)
    })

    it("should return customer traffic count", () => {
      const data = getConsolidatedData()

      expect(data.summary.totalCustomers).toBe(5)
    })

    it("should return inventory item count", () => {
      const data = getConsolidatedData()

      expect(data.summary.totalInventoryItems).toBe(2)
    })

    it("should return a rows array", () => {
      const data = getConsolidatedData()

      expect(Array.isArray(data.rows)).toBe(true)
      expect(data.rows.length).toBeGreaterThan(0)
    })

    it("each row should have all required columns", () => {
      const data = getConsolidatedData()

      data.rows.forEach((row) => {
        expect(row).toHaveProperty("date")
        expect(row).toHaveProperty("orderId")
        expect(row).toHaveProperty("itemName")
        expect(row).toHaveProperty("category")
        expect(row).toHaveProperty("quantitySold")
        expect(row).toHaveProperty("totalAmount")
        expect(row).toHaveProperty("inStock")
        expect(row).toHaveProperty("inventoryStatus")
      })
    })

    it("should cross-reference sales with inventory data", () => {
      const data = getConsolidatedData()

      const salesRows = data.rows.filter((r) => r.orderId !== "N/A")
      salesRows.forEach((row) => {
        expect(typeof row.itemName).toBe("string")
        expect(row.itemName.length).toBeGreaterThan(0)
      })
    })

    it("should return salesByItem array", () => {
      const data = getConsolidatedData()

      expect(Array.isArray(data.salesByItem)).toBe(true)
      expect(data.salesByItem.length).toBe(3)
    })

    it("should return inventorySummary array", () => {
      const data = getConsolidatedData()

      expect(Array.isArray(data.inventorySummary)).toBe(true)
      expect(data.inventorySummary.length).toBe(2)
    })

    it("should return trafficByHour with 24 entries", () => {
      const data = getConsolidatedData()

      expect(Array.isArray(data.trafficByHour)).toBe(true)
      expect(data.trafficByHour.length).toBe(24)
    })
  })
})
