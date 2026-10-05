const insightsService = require("../services/insightsService")

async function getInsights(req, res) {
  try {
    const data = await insightsService.getInsights({
      start: req.query.start,
      end: req.query.end,
    })

    res.set("Cache-Control", "public, max-age=900")
    res.status(200).json({
      data,
    })
  } catch (err) {
    res.status(500).json({
      error: err.message,
    })
  }
}

module.exports = {
  getInsights,
}
