const aiNarrator = require("../services/aiNarrator")
const chartExplanations = require('../services/chartExplanationService')

function validInsight(body) {
  return (
    body &&
    typeof body === "object" &&
    typeof body.key === "string" &&
    body.key.length > 0 &&
    typeof body.metric === "string" &&
    typeof body.value === "string" &&
    typeof body.insight === "string" &&
    Array.isArray(body.numbers)
  )
}

async function explainInsight(req, res) {
  try {
    if (!validInsight(req.body && req.body.insight)) {
      return res.status(400).json({
        error: "Request body must include insight {key, metric, value, insight, numbers[]}.",
      })
    }
    const result = await aiNarrator.narrate(req.body.insight)
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    })
  }
}

module.exports = {
  explainInsight,
  async explainChart(req, res, next) {
    const controller = new globalThis.AbortController()
    const cancel = () => { if (!res.writableFinished) controller.abort() }
    req.on('aborted', cancel); res.on('close', cancel)
    const timeout = globalThis.setTimeout(() => controller.abort(), 18000)
    const aborted = new Promise((_resolve, reject) => controller.signal.addEventListener('abort', () => reject(Object.assign(new Error('Chart explanation timed out.'), { statusCode: 504 })), { once: true }))
    try {
      const data = await Promise.race([chartExplanations.explainChart(req.user, req.body, { signal: controller.signal }), aborted])
      if (!controller.signal.aborted) res.json({ data })
      else if (!res.destroyed) res.status(504).json({ error: 'Chart explanation timed out. Try again.' })
    } catch (err) {
      if (res.destroyed) return
      if (err.statusCode === 499 && !res.destroyed) res.status(504).json({ error: 'Chart explanation timed out. Try again.' })
      else next(err)
    } finally { globalThis.clearTimeout(timeout); req.off('aborted', cancel); res.off('close', cancel) }
  },
}
