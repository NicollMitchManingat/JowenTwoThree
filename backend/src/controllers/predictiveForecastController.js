const predictiveForecastService = require("../services/predictiveForecastService")

async function getForecast(req, res) {
  try {
    const data = await predictiveForecastService.getSalesForecast({ asOf: req.query.asOf })

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
  getForecast,
}
