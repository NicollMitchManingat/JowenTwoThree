const express = require("express")
const router = express.Router()

const { getConsolidated, getInventoryAnalytics } = require("../controllers/consolidatedDataController")

router.get("/inventory", getInventoryAnalytics)
router.get("/", getConsolidated)

module.exports = router
