const request = require("supertest")

const app = require("../../src/app")

const insightsService = require("../../src/services/insightsService")

const ENVELOPE = {
  generatedAt: "2026-09-28T12:00:00.000Z",
  windowDays: 28,
  range: { start: "2026-08-31T00:00:00.000Z", end: "2026-09-28T12:00:00.000Z" },
  insights: [
    {
      key: "forecast",
      metric: "Forecast Revenue",
      value: "₱2,100 next 7 days",
      insight: "+5% vs last 7 days",
      impact: "Positive",
      numbers: [2100, 5, 2000],
      detail: {},
    },
  ],
}

describe("AI Insights Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /api/ai-insights", () => {
    it("should return the insights envelope", async () => {
      vi.spyOn(insightsService, "getInsights").mockResolvedValue(ENVELOPE)

      const res = await request(app).get("/api/ai-insights?start=2026-08-31&end=2026-09-28")

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual(ENVELOPE)
      expect(insightsService.getInsights).toHaveBeenCalledWith(
        expect.objectContaining({ start: "2026-08-31", end: "2026-09-28" })
      )
    })

    it("should return an empty insights list when there is no history", async () => {
      vi.spyOn(insightsService, "getInsights").mockResolvedValue({
        ...ENVELOPE,
        insights: [],
      })

      const res = await request(app).get("/api/ai-insights")

      expect(res.status).toBe(200)
      expect(res.body.data.insights).toEqual([])
    })

    it("should return HTTP 500 when the service throws an error", async () => {
      vi.spyOn(insightsService, "getInsights").mockRejectedValue(
        new Error("Supabase is not configured")
      )

      const res = await request(app).get("/api/ai-insights")

      expect(res.status).toBe(500)
      expect(res.body).toEqual({
        error: "Supabase is not configured",
      })
    })
  })
})
