const {
  resetDeadModels,
  getNarratorConfig,
  providersFromConfig,
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
  geminiKey: "g-key",
  groqKey: "q-key",
  geminiModels: ["gemini-m"],
  groqModels: ["groq-m1", "groq-m2"],
  geminiBaseUrl: "http://gemini.test",
  groqBaseUrl: "http://groq.test",
  timeoutMs: 500,
}

const okFetch = (text) => async () => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content: JSON.stringify({ text }) } }] }),
})

beforeEach(() => {
  resetDeadModels()
})

describe("aiNarrator config and templates", () => {
  it("should default to keyless template mode with stock models", () => {
    const cfg = getNarratorConfig({})
    expect(cfg.geminiKey).toBe("")
    expect(cfg.groqKey).toBe("")
    expect(cfg.enabled).toBe(true)
    expect(cfg.geminiModels.length).toBeGreaterThan(0)
    expect(cfg.groqModels.length).toBeGreaterThan(0)
  })

  it("should ship direct model IDs without gateway aliases", () => {
    const cfg = getNarratorConfig({})
    ;[...cfg.geminiModels, ...cfg.groqModels].forEach((m) => {
      expect(m.endsWith(":free")).toBe(false)
    })
  })

  it("should honor env overrides", () => {
    const cfg = getNarratorConfig({
      GEMINI_API_KEY: "gk",
      GROQ_API_KEY: "qk",
      AI_EXPLAIN_ENABLED: "false",
      AI_NARRATOR_GEMINI_MODELS: "ga,gb",
      AI_NARRATOR_GROQ_MODELS: "qa",
      AI_NARRATOR_TIMEOUT_MS: "123",
    })
    expect(cfg).toMatchObject({ geminiKey: "gk", groqKey: "qk", enabled: false, timeoutMs: 123 })
    expect(cfg.geminiModels).toEqual(["ga", "gb"])
    expect(cfg.groqModels).toEqual(["qa"])
  })

  it("providersFromConfig should order Gemini first and skip keyless providers", () => {
    expect(providersFromConfig(CONFIG).map((p) => p.name)).toEqual(["gemini", "groq"])
    expect(providersFromConfig({ ...CONFIG, geminiKey: "" }).map((p) => p.name)).toEqual(["groq"])
    expect(providersFromConfig({ ...CONFIG, geminiKey: "", groqKey: "" })).toEqual([])
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

  it("buildPrompt should direct suggestions at the manager, never a team", () => {
    const { system } = buildPrompt(INSIGHT)
    expect(system).toMatch(/as 'you'/)
    expect(system).toMatch(/never address a group/i)
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

  it("should reject team greetings but accept H-words", () => {
    expect(() => validateNarration("Hey team, revenue is up.", INSIGHT)).toThrow(/greeting/)
    expect(() => validateNarration("Hello everyone, stock up.", INSIGHT)).toThrow(/greeting/)
    expect(() => validateNarration("Hi, schedule extra staff.", INSIGHT)).toThrow(/greeting/)
    expect(() => validateNarration("High demand at noon, schedule extra staff.", INSIGHT)).not.toThrow()
    expect(() => validateNarration("History shows ₱2,100 over 7 days.", INSIGHT)).not.toThrow()
  })

  it("should version cache keys so voice changes retire old wordings", () => {
    const { PROMPT_VERSION, factsKey } = require("../../src/services/aiNarrator")
    expect(PROMPT_VERSION).toBeGreaterThan(1)
    expect(factsKey(INSIGHT).startsWith(`v${PROMPT_VERSION}|`)).toBe(true)
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
      config: { ...CONFIG, geminiKey: "", groqKey: "" },
      fetchImpl,
      cache: createNarrationCache(),
    })
    expect(out).toMatchObject({ source: "template" })
    expect(out.text).toContain("₱2,100")
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("should try Groq after Gemini fails", async () => {
    const calls = []
    const fetchImpl = async (url, opts) => {
      calls.push(url)
      if (String(url).startsWith("http://gemini.test")) return { ok: false, status: 429 }
      return okFetch("Revenue of ₱2,100 over 7 days, up 5%.")()
    }
    const out = await narrate(INSIGHT, { config: CONFIG, fetchImpl, cache: createNarrationCache() })
    expect(calls[0]).toContain("gemini.test")
    expect(calls[1]).toContain("groq.test")
    expect(out).toMatchObject({ source: "groq", model: "groq-m1" })
  })

  it("should skip a provider without a key", async () => {
    const calls = []
    const fetchImpl = async (url) => {
      calls.push(url)
      return okFetch("Revenue of ₱2,100 over 7 days, up 5%.")()
    }
    const out = await narrate(INSIGHT, {
      config: { ...CONFIG, geminiKey: "" },
      fetchImpl,
      cache: createNarrationCache(),
    })
    expect(calls.every((u) => String(u).includes("groq.test"))).toBe(true)
    expect(out).toMatchObject({ source: "groq" })
  })

  it("should fall back to template when every provider fails", async () => {
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
      config: { ...CONFIG, groqKey: "" },
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
      config: { ...CONFIG, groqKey: "", timeoutMs: 30 },
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

  it("should include the provider message in failure logs", async () => {
    const errors = []
    const orig = console.error
    console.error = (...args) => { errors.push(args.join(" ")) }
    try {
      const fetchImpl = async () => ({
        ok: false,
        status: 429,
        text: async () => '{"error":"upstream rate limited, retry soon"}',
        headers: { get: (n) => (n === "x-ratelimit-remaining" ? "0" : null) },
      })
      await narrate(INSIGHT, {
        config: { ...CONFIG, groqKey: "" },
        fetchImpl,
        cache: createNarrationCache(),
      })
    } finally {
      console.error = orig
    }
    expect(errors.some((m) => m.includes("upstream rate limited"))).toBe(true)
    expect(errors.some((m) => m.includes("remaining=0"))).toBe(true)
    expect(errors.some((m) => m.includes("gemini/gemini-m"))).toBe(true)
  })
})

describe("dead-model memoization", () => {
  const deadCfg = {
    enabled: true,
    geminiKey: "g-key",
    groqKey: "",
    geminiModels: ["dead-m", "live-m"],
    groqModels: [],
    geminiBaseUrl: "http://gemini.test",
    groqBaseUrl: "http://groq.test",
    timeoutMs: 500,
  }
  const notFound = () => ({
    ok: false,
    status: 404,
    text: async () => '{"error":{"message":"The model `dead-m` does not exist or you do not have access to it."}}',
    headers: { get: () => null },
  })

  it("should skip a 404 model on later taps without calling it", async () => {
    const chatCalls = []
    const fetchImpl = async (url, opts) => {
      const model = JSON.parse(opts.body).model
      chatCalls.push(model)
      if (model === "dead-m") return notFound()
      return okFetch("Revenue of ₱2,100 over 7 days, up 5%.")()
    }
    const first = await narrate(INSIGHT, { config: deadCfg, fetchImpl, cache: createNarrationCache() })
    expect(chatCalls).toEqual(["dead-m", "live-m"])
    expect(first).toMatchObject({ source: "gemini", model: "live-m" })

    chatCalls.length = 0
    const second = await narrate(INSIGHT, { config: deadCfg, fetchImpl, cache: createNarrationCache() })
    expect(chatCalls).toEqual(["live-m"])
    expect(second).toMatchObject({ source: "gemini", model: "live-m" })
  })

  it("should retry a dead model after its memo expires", async () => {
    const chatCalls = []
    const fetchImpl = async (url, opts) => {
      chatCalls.push(JSON.parse(opts.body).model)
      return notFound()
    }
    await narrate(INSIGHT, { config: deadCfg, fetchImpl, cache: createNarrationCache() })
    expect(chatCalls).toEqual(["dead-m", "live-m"])

    const realNow = Date.now()
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(realNow + 3600001)
    try {
      chatCalls.length = 0
      await narrate(INSIGHT, { config: deadCfg, fetchImpl, cache: createNarrationCache() })
      expect(chatCalls).toEqual(["dead-m", "live-m"])
    } finally {
      nowSpy.mockRestore()
    }
  })

  it("should name the fix for retired vs inaccessible models", async () => {
    const errors = []
    const orig = console.error
    console.error = (...args) => { errors.push(args.join(" ")) }
    try {
      const retired = () => ({
        ok: false,
        status: 404,
        text: async () => '{"error":{"message":"This model is no longer available to new users."}}',
        headers: { get: () => null },
      })
      await narrate(INSIGHT, {
        config: deadCfg,
        fetchImpl: retired,
        cache: createNarrationCache(),
      })
    } finally {
      console.error = orig
    }
    expect(errors.some((m) => m.includes("AI_NARRATOR_GEMINI_MODELS"))).toBe(true)
  })
})
