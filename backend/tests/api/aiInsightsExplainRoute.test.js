const request = require("supertest")

const app = require("../../src/app")

const aiNarrator = require("../../src/services/aiNarrator")

const INSIGHT = {
  key: "forecast",
  metric: "Forecast Revenue",
  value: "₱2,100 next 7 days",
  insight: "+5% vs last 7 days",
  impact: "Positive",
  numbers: [2100, 5, 2000],
}

describe("AI Insights Explain Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("POST /api/ai-insights/explain", () => {
    it("should return narrated text with its source", async () => {
      vi.spyOn(aiNarrator, "narrate").mockResolvedValue({
        text: "Revenue of ₱2,100 over 7 days, up 5%.",
        source: "openrouter",
        model: "google/gemma-4-31b-it:free",
      })

      const res = await request(app)
        .post("/api/ai-insights/explain")
        .send({ insight: INSIGHT })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ source: "openrouter" })
      expect(res.body.text).toContain("₱2,100")
      expect(aiNarrator.narrate).toHaveBeenCalledWith(INSIGHT)
    })

    it("should return HTTP 400 for a malformed insight body", async () => {
      const spy = vi.spyOn(aiNarrator, "narrate")
      const res = await request(app)
        .post("/api/ai-insights/explain")
        .send({ insight: { key: "forecast" } })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty("error")
      expect(spy).not.toHaveBeenCalled()
    })

    it("should return HTTP 500 when narration throws unexpectedly", async () => {
      vi.spyOn(aiNarrator, "narrate").mockRejectedValue(new Error("boom"))

      const res = await request(app)
        .post("/api/ai-insights/explain")
        .send({ insight: INSIGHT })

      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: "boom" })
    })
  })
})
