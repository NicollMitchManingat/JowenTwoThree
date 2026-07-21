const predictiveForecastService = require("../services/predictiveForecastService")

function getForecast(req, res) {
  try {
    const data = predictiveForecastService.getSalesForecast()

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
  getForecast,
}