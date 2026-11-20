const consolidated = require("../services/consolidatedDataService")
const inventoryAnalytics = require("../services/inventoryAnalyticsService")
const predictive = require('../services/predictiveReportService')
const { calendarStart, DAY_MS } = require('../services/analyticsReadService')

function pickParam(value) {
  if (Array.isArray(value)) return value[0]
  if (typeof value === "string" && value.trim() !== "") return value.trim()
  return undefined
}

async function getConsolidated(req, res) {
  try {
    const options = {
      from: pickParam(req.query.from),
      to: pickParam(req.query.to),
      category: pickParam(req.query.category),
      rangeStart: pickParam(req.query.rangeStart),
      rangeEnd: pickParam(req.query.rangeEnd),
    }
    let usageRequest
    if (req.query.includeUsage === 'true') {
      const first = calendarStart(options.from), last = calendarStart(options.to)
      if (!first || !last || first > last) throw Object.assign(new Error('Choose valid From and To dates for the complete workbook.'), { statusCode: 400 })
      usageRequest = { start: first.toISOString(), end: new Date(last.getTime() + DAY_MS - 1).toISOString(), usage: 'selected' }
    }
    const [data, usage] = await Promise.all([
      consolidated.getConsolidatedData(options), usageRequest ? inventoryAnalytics.getInventoryAnalytics(usageRequest) : null,
    ])
    if (usage) {
      const balances = new Map(data.inventorySummary.map(row => [String(row.id), row]))
      if (balances.size !== usage.planning.length || usage.planning.some(row => {
        const balance = balances.get(String(row.id))
        return !balance || String(balance.inStock) !== row.quantity || balance.unit !== row.unit || balance.unitVersion !== row.unitVersion
      })) throw Object.assign(new Error('Inventory changed while preparing the workbook. Refresh and retry.'), { statusCode: 503 })
      data.inventoryAnalytics = usage
    }

    res.status(200).json({ data })
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message })
  }
}

async function getInventoryAnalytics(req, res) {
  try {
    const data = await inventoryAnalytics.getInventoryAnalytics({ start: req.query.start, end: req.query.end, usage: req.query.usage })
    res.status(200).json({ data })
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }) }
}

async function getPredictiveReport(req, res) {
  try {
    res.json({ data: await predictive.getPredictiveReport({ start: req.query.start, end: req.query.end }) })
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }) }
}

module.exports = { getConsolidated, getInventoryAnalytics, getPredictiveReport }
