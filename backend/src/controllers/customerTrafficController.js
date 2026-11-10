const validation = require('../services/forecastValidationService')
const customerTrafficService = require('../services/customerTrafficService')
async function getCustomerTraffic(req, res) {
  try {
    res.json({ data: await customerTrafficService.getCustomerTrafficData({ start: req.query.start, end: req.query.end }) })
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }) }
}
async function getTrafficForecast(req, res) {
  try {
    res.json({ data: await customerTrafficService.getTrafficForecast({ asOf: req.query.asOf }) })
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }) }
}

async function getTrafficValidation(req, res) {
  try {
    const data = await validation.getForecastValidation({ metric: 'traffic', asOf: req.query.asOf })
    res.json({ data })
  } catch (err) { res.status(err.statusCode || 500).json({ error: err.message }) }
}

module.exports = { getCustomerTraffic, getTrafficForecast, getTrafficValidation }
