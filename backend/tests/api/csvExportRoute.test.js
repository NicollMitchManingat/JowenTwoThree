const request = require("supertest")
const app = require("../../src/app")

describe("CSV Export Route", () => {
  describe("GET /api/export/csv", () => {
    it("should return HTTP status 200", async () => {
      const res = await request(app).get("/api/export/csv")

      expect(res.status).toBe(200)
    })

    it("should return Content-Type text/csv", async () => {
      const res = await request(app).get("/api/export/csv")

      expect(res.headers["content-type"]).toMatch(/text\/csv/)
    })

    it("should return Content-Disposition with attachment filename", async () => {
      const res = await request(app).get("/api/export/csv")

      expect(res.headers["content-disposition"]).toContain(
        'attachment; filename="consolidated-data.csv"'
      )
    })

    it("should return a CSV string with header row", async () => {
      const res = await request(app).get("/api/export/csv")

      expect(res.text).toContain(
        "Date,Order ID,Item Name,Category,Quantity Sold,Total Amount,In Stock,Inventory Status"
      )
    })

    it("should contain sales data rows", async () => {
      const res = await request(app).get("/api/export/csv")

      expect(res.text).toContain("ORD-001")
      expect(res.text).toContain("Chicken Burger")
      expect(res.text).toContain("ORD-002")
    })

    it("should have at least header + data rows", async () => {
      const res = await request(app).get("/api/export/csv")
      const lines = res.text.split("\n")

      expect(lines.length).toBeGreaterThan(1)
    })

    it("should cross-reference inventory data in CSV output", async () => {
      const res = await request(app).get("/api/export/csv")

      expect(res.text).toContain("Beverage")
      expect(res.text).toContain("Dairy")
    })

    it("should produce valid comma-delimited format", async () => {
      const res = await request(app).get("/api/export/csv")
      const lines = res.text.split("\n")

      lines.forEach((line) => {
        const fields = line.split(",")
        expect(fields.length).toBe(8)
      })
    })
  })
})
