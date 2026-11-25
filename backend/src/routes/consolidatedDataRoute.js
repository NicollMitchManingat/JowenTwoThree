const express = require("express")
const router = express.Router()

const { getConsolidated, getInventoryAnalytics, getPredictiveReport } = require("../controllers/consolidatedDataController")
router.get('/inventory/charts', (req, res, next) => require('../services/inventoryForecastService').getInventoryCharts({ start: req.query.start, end: req.query.end, ingredientId: req.query.ingredientId })
  .then(data => res.json({ data })).catch(next))

router.get("/inventory", getInventoryAnalytics)
router.get("/predictive", getPredictiveReport)
router.get("/", getConsolidated)

module.exports = router
