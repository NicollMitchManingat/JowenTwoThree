// Grounded AI narration for insight cards (OpenRouter, keyless-ready).
// The model NEVER computes and NEVER sees raw rows: it only rephrases the
// deterministic facts + template sentence produced by insightsService.
// validateNarration() enforces that every number in the reply already
// exists in the insight (digit-stock check), so a hallucinated figure can
// never reach the screen — violations fall through to the next model,
// then to template text. With no OPENROUTER_API_KEY configured the chain
// short-circuits to template text with zero network calls, so the feature
// works fully before any key exists.
const DEFAULT_MODELS = [
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
]

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_TIMEOUT_MS = 8000
const MAX_REPLY_CHARS = 600
const CACHE_LIMIT = 200

function getNarratorConfig(env) {
  const source = env || process.env
  const fromList = String(source.AI_NARRATOR_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    enabled: source.AI_EXPLAIN_ENABLED !== "false",
    apiKey: source.OPENROUTER_API_KEY || "",
    models: fromList.length > 0 ? fromList : [...DEFAULT_MODELS],
    baseUrl: source.AI_NARRATOR_BASE_URL || DEFAULT_BASE_URL,
    timeoutMs: Number(source.AI_NARRATOR_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  }
}

// Plain template wording: the guaranteed fallback and the narration seed.
function templateText(insight) {
  const value = (insight && insight.value) || ""
  const finding = (insight && insight.insight) || ""
  return `${value} — ${finding}`.replace(/^ — | — $/g, "").trim() || "See details above."
}

function buildPrompt(insight) {
  const facts = {
    metric: (insight && insight.metric) || "",
    value: (insight && insight.value) || "",
    finding: (insight && insight.insight) || "",
    keyFigures: Array.isArray(insight && insight.numbers) ? insight.numbers : [],
  }
  return {
    system: [
      "You rephrase analytics findings for cafe staff in plain language.",
      "Rules: at most 40 words, friendly tone, no bullet points.",
      "Never add, change, round, or remove any number, date, peso amount,",
      "or percentage. Only figures present in FACTS may appear.",
      'Reply with JSON only: {"text": "..."} and nothing else.',
    ].join(" "),
    user: `FACTS: ${JSON.stringify(facts)}\nDRAFT: ${templateText(insight)}`,
  }
}

// All number-like tokens in a string, normalized for comparison.
// Handles ₱ amounts, commas, decimals, percents, and dash variants
// (the forecast formatter emits U+2212 minus).
function extractNumberTokens(str) {
  const found = new Set()
  const matches = String(str || "").match(/[₱$]?\d[\d,]*(?:\.\d+)?%?/g) || []
  matches.forEach((raw) => {
    const cleaned = raw.replace(/[₱$%,\s]/g, "")
    const n = Number(cleaned)
    if (Number.isFinite(n)) found.add(n)
  })
  return found
}

// Every figure the model is allowed to repeat: the numbers allowlist plus
// every figure already printed in the template wording (voucher names like
// "Weekend 15%", hour labels like "12 PM", template words like "2 staff").
function allowedNumbers(insight) {
  const allowed = new Set(Array.isArray(insight && insight.numbers) ? insight.numbers : [])
  ;[insight && insight.metric, insight && insight.value, insight && insight.insight].forEach((part) => {
    extractNumberTokens(part).forEach((n) => allowed.add(n))
  })
  return allowed
}

function validateNarration(text, insight) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Narration is empty")
  }
  if (text.length > MAX_REPLY_CHARS) {
    throw new Error("Narration exceeds length limit")
  }
  const allowed = allowedNumbers(insight)
  const unknown = [...extractNumberTokens(text)].filter((n) => !allowed.has(n))
  if (unknown.length > 0) {
    throw new Error(`Narration invents figures: ${unknown.join(", ")}`)
  }
  return text.trim()
}

function parseReply(content) {
  if (typeof content !== "string") throw new Error("Model returned no text")
  const trimmed = content.trim()
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed.text === "string") return parsed.text
    throw new Error("Model reply has no text field")
  } catch (err) {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(err.message || "Model reply is not JSON", { cause: err })
    const parsed = JSON.parse(match[0])
    if (!parsed || typeof parsed.text !== "string") {
      throw new Error("Model reply has no text field", { cause: err })
    }
    return parsed.text
  }
}

async function callModel({ baseUrl, apiKey, model, system, user, timeoutMs, fetchImpl }) {
  const fetchFn = fetchImpl || globalThis.fetch
  const controller = new globalThis.AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 120,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Model ${model} failed with status ${res.status}`)
    }
    const json = await res.json()
    return parseReply(json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content)
  } finally {
    globalThis.clearTimeout(timer)
  }
}

function factsKey(insight) {
  return `${(insight && insight.key) || ""}|${JSON.stringify((insight && insight.numbers) || [])}|${(insight && insight.value) || ""}|${(insight && insight.insight) || ""}`
}

function createNarrationCache(limit) {
  const max = Number(limit) > 0 ? Number(limit) : CACHE_LIMIT
  const store = new Map()
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      if (!store.has(key) && store.size >= max) {
        const oldest = store.keys().next().value
        store.delete(oldest)
      }
      store.set(key, value)
    },
    clear: () => store.clear(),
  }
}

const defaultCache = createNarrationCache(CACHE_LIMIT)

// Narrates one insight object {key, metric, value, insight, impact,
// numbers[]}. Always resolves {text, source, model?} — never throws for
// provider reasons (outages, timeouts, 429s, validation failures all fall
// through to template text). fetchImpl/cache/config are injectable for
// tests; production passes nothing.
async function narrate(insight, opts = {}) {
  if (!insight || typeof insight !== "object") throw new Error("Insight is required")
  const config = opts.config || getNarratorConfig()
  const cache = opts.cache || defaultCache
  const fetchImpl = opts.fetchImpl
  const key = factsKey(insight)
  const hit = cache.get(key)
  if (hit) return hit
  const fallback = () => {
    const result = { text: templateText(insight), source: "template" }
    cache.set(key, result)
    return result
  }
  if (!config.enabled || !config.apiKey) return fallback()
  const { system, user } = buildPrompt(insight)
  for (const model of config.models) {
    try {
      const raw = await callModel({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model,
        system,
        user,
        timeoutMs: config.timeoutMs,
        fetchImpl,
      })
      const text = validateNarration(raw, insight)
      const result = { text, source: "openrouter", model }
      cache.set(key, result)
      return result
    } catch (err) {
      console.error(`AI narration via ${model} failed, trying next:`, err && err.message)
    }
  }
  return fallback()
}

module.exports = {
  DEFAULT_MODELS,
  MAX_REPLY_CHARS,
  getNarratorConfig,
  templateText,
  buildPrompt,
  extractNumberTokens,
  allowedNumbers,
  validateNarration,
  parseReply,
  callModel,
  factsKey,
  createNarrationCache,
  narrate,
}
