const express = require("express")

const router = express.Router()

const {
  getForecast,
} = require("../controllers/predictiveForecastController")

router.get("/", getForecast)

module.exports = router