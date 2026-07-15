const request = require("supertest")
const app = require("../../src/app")
const customerTrafficService = require("../../src/services/customerTrafficService")

describe("Customer Traffic Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /api/customer-traffic", () => {
    it("should return customer traffic data when data exists", async () => {
      vi.spyOn(customerTrafficService, "getCustomerTrafficData").mockReturnValue([
        {
          hour: 9,
          customers: 2,
        },
        {
          hour: 10,
          customers: 1,
        },
      ])

      const res = await request(app).get("/api/customer-traffic")

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([
        {
          hour: 9,
          customers: 2,
        },
        {
          hour: 10,
          customers: 1,
        },
      ])
    })

    it("should return an empty customer traffic array when no data exists", async () => {
      vi.spyOn(customerTrafficService, "getCustomerTrafficData").mockReturnValue([])

      const res = await request(app).get("/api/customer-traffic")

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })

    it("should return HTTP 500 when the service throws an error", async () => {
      vi.spyOn(customerTrafficService, "getCustomerTrafficData").mockImplementation(() => {
        throw new Error("Customer traffic data is unavailable")
      })

      const res = await request(app).get("/api/customer-traffic")

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: "Customer traffic data is unavailable",
      })
    })

    it("should return hour and customers properties", async () => {
      vi.spyOn(customerTrafficService, "getCustomerTrafficData").mockReturnValue([
        {
          hour: 9,
          customers: 2,
        },
      ])

      const res = await request(app).get("/api/customer-traffic")

      expect(res.body.data[0]).toHaveProperty("hour")
      expect(res.body.data[0]).toHaveProperty("customers")
    })

    it("should return 24 hourly traffic records", async () => {
      const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        customers: 0,
      }))

      vi.spyOn(customerTrafficService, "getCustomerTrafficData").mockReturnValue(hourlyData)

      const res = await request(app).get("/api/customer-traffic")

      expect(res.body.data).toHaveLength(24)
    })
  })
})