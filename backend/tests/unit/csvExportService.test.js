const { generateCsv } = require("../../src/services/csvExportService")

describe("CSV Export Service", () => {
  describe("generateCsv()", () => {
    const sampleData = {
      rows: [
        {
          date: "2026-07-01",
          orderId: "ORD-001",
          itemName: "Chicken Burger",
          category: "Meals",
          quantitySold: 12,
          totalAmount: 1788,
          inStock: 25,
          inventoryStatus: "Good",
        },
        {
          date: "2026-07-01",
          orderId: "ORD-002",
          itemName: "Iced Coffee",
          category: "Beverage",
          quantitySold: 18,
          totalAmount: 1620,
          inStock: 10,
          inventoryStatus: "Low",
        },
      ],
    }

    it("should return a string", () => {
      const csv = generateCsv(sampleData)

      expect(typeof csv).toBe("string")
    })

    it("should contain the header row", () => {
      const csv = generateCsv(sampleData)

      expect(csv).toContain(
        "Date,Order ID,Item Name,Category,Quantity Sold,Total Amount,In Stock,Inventory Status"
      )
    })

    it("should contain data rows", () => {
      const csv = generateCsv(sampleData)

      expect(csv).toContain("ORD-001")
      expect(csv).toContain("Chicken Burger")
      expect(csv).toContain("ORD-002")
      expect(csv).toContain("Iced Coffee")
    })

    it("should have the correct number of lines (header + data rows)", () => {
      const csv = generateCsv(sampleData)
      const lines = csv.split("\n")

      expect(lines.length).toBe(3)
    })

    it("should handle fields containing commas by quoting them", () => {
      const dataWithComma = {
        rows: [
          {
            date: "2026-07-01",
            orderId: "ORD-100",
            itemName: "Burger, Fries, and Drink",
            category: "Meals",
            quantitySold: 1,
            totalAmount: 199,
            inStock: 5,
            inventoryStatus: "Good",
          },
        ],
      }

      const csv = generateCsv(dataWithComma)

      expect(csv).toContain('"Burger, Fries, and Drink"')
    })

    it("should handle fields containing double quotes", () => {
      const dataWithQuotes = {
        rows: [
          {
            date: "2026-07-01",
            orderId: "ORD-200",
            itemName: 'Special "Combo" Meal',
            category: "Meals",
            quantitySold: 2,
            totalAmount: 398,
            inStock: 8,
            inventoryStatus: "Good",
          },
        ],
      }

      const csv = generateCsv(dataWithQuotes)

      expect(csv).toContain('Special ""Combo"" Meal')
    })

    it("should produce valid CSV format (comma-delimited)", () => {
      const csv = generateCsv(sampleData)
      const lines = csv.split("\n")

      lines.forEach((line) => {
        const fields = line.split(",")
        expect(fields.length).toBe(8)
      })
    })

    it("should work with empty rows", () => {
      const emptyData = { rows: [] }
      const csv = generateCsv(emptyData)
      const lines = csv.split("\n")

      expect(lines.length).toBe(1)
    })
  })
})
