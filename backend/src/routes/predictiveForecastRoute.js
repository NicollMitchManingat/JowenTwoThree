const express = require("express")

const router = express.Router()

const {
  getForecast,
  getValidation,
} = require("../controllers/predictiveForecastController")

router.get("/", getForecast)

router.get("/validation", getValidation)

module.exports = router