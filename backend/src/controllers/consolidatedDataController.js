const consolidated = require("../services/consolidatedDataService")
const inventoryAnalytics = require("../services/inventoryAnalyticsService")

function pickParam(value) {
  if (Array.isArray(value)) return value[0]
  if (typeof value === "string" && value.trim() !== "") return value.trim()
  return undefined
}

async function getConsolidated(req, res) {
  try {
    const data = await consolidated.getConsolidatedData({
      from: pickParam(req.query.from),
      to: pickParam(req.query.to),
      category: pickParam(req.query.category),
      rangeStart: pickParam(req.query.rangeStart),
      rangeEnd: pickParam(req.query.rangeEnd),
    })

    res.status(200).json({ data })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

async function getInventoryAnalytics(req, res) {
  try {
    const data = await inventoryAnalytics.getInventoryAnalytics({ start: req.query.start, end: req.query.end })
    res.status(200).json({ data })
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }) }
}

module.exports = { getConsolidated, getInventoryAnalytics }
