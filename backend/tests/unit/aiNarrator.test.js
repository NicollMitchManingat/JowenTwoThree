const {
  getNarratorConfig,
  templateText,
  buildPrompt,
  extractNumberTokens,
  allowedNumbers,
  validateNarration,
  parseReply,
  createNarrationCache,
  narrate,
} = require("../../src/services/aiNarrator")

const INSIGHT = {
  key: "forecast",
  metric: "Forecast Revenue",
  value: "₱2,100 next 7 days",
  insight: "+5% vs last 7 days",
  impact: "Positive",
  numbers: [2100, 5, 2000],
}

const CONFIG = {
  enabled: true,
  apiKey: "test-key",
  models: ["m1", "m2"],
  baseUrl: "http://ai.test",
  timeoutMs: 500,
}

const okFetch = (text) => async () => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content: JSON.stringify({ text }) } }] }),
})

describe("aiNarrator config and templates", () => {
  it("should default to keyless template mode with stock models", () => {
    const cfg = getNarratorConfig({})
    expect(cfg.apiKey).toBe("")
    expect(cfg.enabled).toBe(true)
    expect(cfg.models.length).toBeGreaterThan(0)
  })

  it("should honor env overrides", () => {
    const cfg = getNarratorConfig({
      OPENROUTER_API_KEY: "k",
      AI_EXPLAIN_ENABLED: "false",
      AI_NARRATOR_MODELS: "a,b",
      AI_NARRATOR_TIMEOUT_MS: "123",
    })
    expect(cfg).toMatchObject({ apiKey: "k", enabled: false, timeoutMs: 123 })
    expect(cfg.models).toEqual(["a", "b"])
  })

  it("templateText should join value and finding", () => {
    expect(templateText(INSIGHT)).toBe("₱2,100 next 7 days — +5% vs last 7 days")
  })

  it("buildPrompt should embed facts and the no-new-numbers rule", () => {
    const { system, user } = buildPrompt(INSIGHT)
    expect(user).toContain("₱2,100 next 7 days")
    expect(system).toMatch(/never add/i)
    expect(system).toMatch(/JSON/)
  })
})

describe("digit-stock validation", () => {
  it("should extract peso, percent, and plain figures", () => {
    expect([...extractNumberTokens("₱18,500 and 12% over 7 days")]).toEqual(
      expect.arrayContaining([18500, 12, 7])
    )
  })

  it("should allow figures from the template wording, not just numbers[]", () => {
    // Voucher names ("Weekend 15%"), hour labels ("12 PM"), and template
    // words ("2 staff") must not trip the check.
    const insight = {
      ...INSIGHT,
      value: "Weekend 15%",
      insight: "Schedule 2 extra staff 12 PM",
      numbers: [75],
    }
    expect(() => validateNarration("Repeat Weekend 15% with 2 staff at 12 PM for ₱75.", insight)).not.toThrow()
  })

  it("should accept grounded rephrasing", () => {
    expect(() => validateNarration("Revenue of ₱2,100 over 7 days, up 5%.", INSIGHT)).not.toThrow()
  })

  it("should reject invented figures", () => {
    expect(() => validateNarration("Revenue of ₱9,999 next 7 days.", INSIGHT)).toThrow(/invents figures/)
    expect(() => validateNarration("Up 42% vs last week.", INSIGHT)).toThrow(/invents figures/)
  })

  it("should reject empty and overlong replies", () => {
    expect(() => validateNarration("  ", INSIGHT)).toThrow(/empty/)
    expect(() => validateNarration("x".repeat(601), INSIGHT)).toThrow(/length/)
  })

  it("parseReply should handle raw and wrapped JSON", () => {
    expect(parseReply('{"text":"hi"}')).toBe("hi")
    expect(parseReply('prefix {"text":"hi"} suffix')).toBe("hi")
    expect(() => parseReply("no json here")).toThrow()
    expect(() => parseReply('{"nope":1}')).toThrow(/no text field/)
  })
})

describe("narrate chain", () => {
  it("should use template text with zero network calls when keyless", async () => {
    const fetchImpl = vi.fn()
    const out = await narrate(INSIGHT, {
      config: { ...CONFIG, apiKey: "" },
      fetchImpl,
      cache: createNarrationCache(),
    })
    expect(out).toMatchObject({ source: "template" })
    expect(out.text).toContain("₱2,100")
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("should try the next model after a failure", async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push(JSON.parse(opts.body).model)
      if (calls.length === 1) return { ok: false, status: 429 }
      return okFetch("Revenue of ₱2,100 over 7 days, up 5%.")()
    }
    const out = await narrate(INSIGHT, { config: CONFIG, fetchImpl, cache: createNarrationCache() })
    expect(calls).toEqual(["m1", "m2"])
    expect(out).toMatchObject({ source: "openrouter", model: "m2" })
  })

  it("should fall back to template when every model fails", async () => {
    const out = await narrate(INSIGHT, {
      config: CONFIG,
      fetchImpl: async () => ({ ok: false, status: 500 }),
      cache: createNarrationCache(),
    })
    expect(out.source).toBe("template")
    expect(out.text).toContain("₱2,100")
  })

  it("should fall back to template when validation rejects the reply", async () => {
    const out = await narrate(INSIGHT, {
      config: { ...CONFIG, models: ["m1"] },
      fetchImpl: okFetch("Revenue of ₱9,999 next week."),
      cache: createNarrationCache(),
    })
    expect(out.source).toBe("template")
  })

  it("should fall back to template when the provider hangs past timeout", async () => {
    const hanging = (url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener("abort", () => reject(new Error("aborted")))
    })
    const out = await narrate(INSIGHT, {
      config: { ...CONFIG, models: ["m1"], timeoutMs: 30 },
      fetchImpl: hanging,
      cache: createNarrationCache(),
    })
    expect(out.source).toBe("template")
  }, 10000)

  it("should serve repeat taps from cache without new calls", async () => {
    const cache = createNarrationCache()
    const fetchImpl = vi.fn(okFetch("Revenue of ₱2,100 over 7 days, up 5%."))
    await narrate(INSIGHT, { config: CONFIG, fetchImpl, cache })
    await narrate(INSIGHT, { config: CONFIG, fetchImpl, cache })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("should throw for a missing insight", async () => {
    await expect(narrate(null, { config: CONFIG })).rejects.toThrow("Insight is required")
  })
})
