const salesTrendService = require("../services/salesTrendService")

function getSalesTrend(req, res) {
  try {
    const data = salesTrendService.getSalesTrendData()

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
  getSalesTrend,
}