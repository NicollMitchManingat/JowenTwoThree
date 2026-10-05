const aiNarrator = require("../services/aiNarrator")

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
}
