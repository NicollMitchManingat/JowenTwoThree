const express = require("express")
const router = express.Router()

const {
  getAnalyticsData,
} = require("../services/analyticsService")

router.get("/", (req, res) => {
  const data = getAnalyticsData()

  res.status(200).json({
    data,
  })
})

module.exports = router