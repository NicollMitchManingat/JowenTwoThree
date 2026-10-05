const express = require("express")

const router = express.Router()

const {
  getInsights,
} = require("../controllers/aiInsightsController")

router.get("/", getInsights)

module.exports = router
