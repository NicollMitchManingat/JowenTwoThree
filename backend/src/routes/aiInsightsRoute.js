const express = require("express")

const router = express.Router()

const {
  getInsights,
} = require("../controllers/aiInsightsController")

const {
  explainInsight,
} = require("../controllers/aiExplainController")

router.get("/", getInsights)
router.post("/explain", explainInsight)

module.exports = router
