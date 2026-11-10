const insightsService = require("../services/insightsService")

async function getInsights(req, res) {
  try {
    const data = await insightsService.getInsights({
      start: req.query.start,
      end: req.query.end,
    })

    res.set("Cache-Control", "private, no-store")
    res.status(200).json({
      data,
    })
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.message,
    })
  }
}

module.exports = {
  getInsights,
}
