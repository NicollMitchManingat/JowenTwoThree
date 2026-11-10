const express = require("express")
const router = express.Router()

const { getConsolidated, getInventoryAnalytics, getPredictiveReport } = require("../controllers/consolidatedDataController")

router.get("/inventory", getInventoryAnalytics)
router.get("/predictive", getPredictiveReport)
router.get("/", getConsolidated)

module.exports = router
