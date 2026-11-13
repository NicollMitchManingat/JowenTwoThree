const request = require("supertest")

const app = require("../../src/app")

const aiNarrator = require("../../src/services/aiNarrator")
const access = require('../../src/services/accessService')
const chartExplanations = require('../../src/services/chartExplanationService')

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
    vi.spyOn(access, 'authenticate').mockResolvedValue({ user: { id: 'chart-test-admin', role: 'admin', permissions: ['analytics'] }, sessionId: 'test-session' })
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


describe('protected chart explanation endpoint', () => {
 beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(access,'authenticate').mockResolvedValue({user:{id:'chart-route-admin',role:'admin',permissions:['analytics']},sessionId:'test'}) })
 it('requires a live authenticated session', async () => {
  vi.spyOn(access,'authenticate').mockRejectedValue(Object.assign(new Error('Please sign in'),{statusCode:401}))
  const res=await request(app).post('/api/ai-insights/charts/explain').send({chartId:'payment-mix'})
  expect(res.status).toBe(401);expect(res.headers['cache-control']).toBe('private, no-store')
 })
 it('blocks accounts without Analytics access before explanation work', async () => {
  vi.spyOn(access,'authenticate').mockResolvedValue({user:{id:'cashier',role:'cashier',permissions:['pos']}})
  const explain=vi.spyOn(chartExplanations,'explainChart')
  const res=await request(app).post('/api/ai-insights/charts/explain').send({chartId:'payment-mix'})
  expect(res.status).toBe(403);expect(explain).not.toHaveBeenCalled()
 })
 it('returns structured explanation data with private cache headers', async () => {
  vi.spyOn(chartExplanations,'explainChart').mockResolvedValue({chartId:'payment-mix',source:'template',observations:[{id:'f0',text:'Verified cash total.'}],actions:[],limitations:[]})
  const res=await request(app).post('/api/ai-insights/charts/explain').send({chartId:'payment-mix'})
  expect(res.status).toBe(200);expect(res.body.data.source).toBe('template');expect(res.headers['cache-control']).toBe('private, no-store')
 })
 it('rejects cross-origin chart explanation requests', async () => {
  const res=await request(app).post('/api/ai-insights/charts/explain').set('Origin','https://untrusted.invalid').send({chartId:'payment-mix'})
  expect(res.status).toBe(403)
 })
})


it('throttles repeated chart requests per authenticated account',async()=>{
 vi.restoreAllMocks()
 vi.spyOn(access,'authenticate').mockResolvedValue({user:{id:'chart-throttle-account',role:'admin',permissions:['analytics']},sessionId:'test'})
 const explain=vi.spyOn(chartExplanations,'explainChart').mockResolvedValue({source:'template'})
 let response
 for(let count=0;count<11;count++) response=await request(app).post('/api/ai-insights/charts/explain').send({chartId:'payment-mix'})
 expect(response.status).toBe(429);expect(explain).toHaveBeenCalledTimes(10)
})
