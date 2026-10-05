// Grounded AI narration for insight cards (direct providers, keyless-ready).
// Chain: Gemini first, Groq second, template text last. Both provider APIs
// are OpenAI-compatible, so one client shape serves both — no gateway,
// no rotating aliases, no middleman hop.
// The model NEVER computes and NEVER sees raw rows: it only rephrases the
// deterministic facts + template sentence produced by insightsService.
// validateNarration() enforces that every number in the reply already
// exists in the insight (digit-stock check), so a hallucinated figure can
// never reach the screen — violations fall through to the next model,
// then to template text. With no provider keys configured the chain
// short-circuits to template text with zero network calls, so the feature
// works fully before any key exists.
// Defaults are candidates, not promises: providers retire IDs and gate
// access per key. Dead IDs are memoized-skipped at runtime (see below),
// so an over-broad list degrades to the live subset automatically.
// Gemini ID per Google's own retirement message; Groq IDs per their docs
// (gpt-oss-20b first — historically the most accessible free weight).
const DEFAULT_GEMINI_MODELS = ["gemini-3.5-flash-lite"]
const DEFAULT_GROQ_MODELS = ["openai/gpt-oss-20b", "llama-3.1-8b-instant", "llama-3.3-70b-versatile"]

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
const GROQ_BASE_URL = "https://api.groq.com/openai/v1"
const DEFAULT_TIMEOUT_MS = 8000
const MAX_REPLY_CHARS = 600
const CACHE_LIMIT = 200

function modelList(value, fallback) {
  const list = String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return list.length > 0 ? list : [...fallback]
}

function getNarratorConfig(env) {
  const source = env || process.env
  return {
    enabled: source.AI_EXPLAIN_ENABLED !== "false",
    geminiKey: source.GEMINI_API_KEY || "",
    groqKey: source.GROQ_API_KEY || "",
    geminiModels: modelList(source.AI_NARRATOR_GEMINI_MODELS, DEFAULT_GEMINI_MODELS),
    groqModels: modelList(source.AI_NARRATOR_GROQ_MODELS, DEFAULT_GROQ_MODELS),
    geminiBaseUrl: source.AI_NARRATOR_GEMINI_BASE_URL || GEMINI_BASE_URL,
    groqBaseUrl: source.AI_NARRATOR_GROQ_BASE_URL || GROQ_BASE_URL,
    timeoutMs: Number(source.AI_NARRATOR_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  }
}

// Ordered provider attempts from config, skipping providers without keys.
function providersFromConfig(config) {
  const providers = []
  if (config.geminiKey) {
    providers.push({ name: "gemini", baseUrl: config.geminiBaseUrl, apiKey: config.geminiKey, models: config.geminiModels })
  }
  if (config.groqKey) {
    providers.push({ name: "groq", baseUrl: config.groqBaseUrl, apiKey: config.groqKey, models: config.groqModels })
  }
  return providers
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

// Best-effort diagnostics: what the provider said (truncated) plus any
// rate-limit headers. Stubs in tests may omit .text()/headers — guarded.
async function failureDetail(res) {
  let snippet = ""
  try {
    if (res && typeof res.text === "function") snippet = String(await res.text()).slice(0, 300)
  } catch {
    snippet = ""
  }
  let rateLimit = {}
  try {
    const get = (n) => (res && res.headers && typeof res.headers.get === "function" ? res.headers.get(n) : undefined)
    rateLimit = { limit: get("x-ratelimit-limit"), remaining: get("x-ratelimit-remaining"), reset: get("x-ratelimit-reset") }
  } catch {
    // Headers unreadable — return the empty default above.
  }
  return { snippet, rateLimit }
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
      const { snippet, rateLimit } = await failureDetail(res)
      const remaining = rateLimit.remaining !== undefined ? ` remaining=${rateLimit.remaining}` : ""
      const error = new Error(
        `Model ${model} failed with status ${res.status}${remaining}${snippet ? `: ${snippet}` : ""}`
      )
      error.status = res.status
      error.rateLimit = rateLimit
      throw error
    }
    const json = await res.json()
    return parseReply(json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content)
  } finally {
    globalThis.clearTimeout(timer)
  }
}

// Dead-model memo: a 404 means the ID is retired or the key can't reach
// it — retrying every tap burns calls for nothing. Remember per
// provider+model for DEAD_MODEL_TTL_MS and skip silently (the mark message
// below already explained once); any success clears the entry. Test hook
// resetDeadModels() clears it.
let deadModels = new Map()
const DEAD_MODEL_TTL_MS = 3600000

function resetDeadModels() {
  deadModels = new Map()
}

function deadKey(provider, model) {
  return `${provider}/${model}`
}

function isModelDead(provider, model, now) {
  const at = deadModels.get(deadKey(provider, model))
  return at !== undefined && (now || Date.now()) - at < DEAD_MODEL_TTL_MS
}

// One-line operator hint per failure class so logs read as instructions:
// retired IDs name their fix, access problems point at the models endpoint.
function deadModelHint(provider, err) {
  const msg = String((err && err.message) || "")
  if (/no longer available/i.test(msg)) {
    return `Retired upstream — update AI_NARRATOR_${provider.toUpperCase()}_MODELS to a current ID.`
  }
  if (/does not exist|not found|access/i.test(msg)) {
    return `Unknown ID or key lacks access — list yours via GET ${provider === "groq" ? "https://api.groq.com/openai/v1/models" : "https://generativelanguage.googleapis.com/v1beta/models"} then set AI_NARRATOR_${provider.toUpperCase()}_MODELS.`
  }
  return "Override via AI_NARRATOR_*_MODELS."
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
  if (!config.enabled) return fallback()
  const providers = providersFromConfig(config)
  if (providers.length === 0) return fallback()
  const { system, user } = buildPrompt(insight)
  for (const provider of providers) {
    for (const model of provider.models) {
      if (isModelDead(provider.name, model)) continue
      try {
        const raw = await callModel({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model,
          system,
          user,
          timeoutMs: config.timeoutMs,
          fetchImpl,
        })
        const text = validateNarration(raw, insight)
        deadModels.delete(deadKey(provider.name, model))
        const result = { text, source: provider.name, model }
        cache.set(key, result)
        return result
      } catch (err) {
        console.error(`AI narration via ${provider.name}/${model} failed, trying next:`, err && err.message)
        if (err && err.status === 404 && !deadModels.has(deadKey(provider.name, model))) {
          deadModels.set(deadKey(provider.name, model), Date.now())
          console.error(`AI model ${provider.name}/${model} marked dead for 1h. ${deadModelHint(provider.name, err)}`)
        }
      }
    }
  }
  return fallback()
}

module.exports = {
  DEFAULT_GEMINI_MODELS,
  DEFAULT_GROQ_MODELS,
  MAX_REPLY_CHARS,
  getNarratorConfig,
  providersFromConfig,
  templateText,
  buildPrompt,
  extractNumberTokens,
  allowedNumbers,
  validateNarration,
  parseReply,
  callModel,
  factsKey,
  createNarrationCache,
  resetDeadModels,
  narrate,
}
