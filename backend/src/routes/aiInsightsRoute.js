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
router.post('/charts/explain', (req, res, next) => require('../middleware/authentication').throttle(req, res, next, `chart-explain:${req.user.id}`),
  require('../controllers/aiExplainController').explainChart)

module.exports = router
