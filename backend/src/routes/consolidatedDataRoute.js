const express = require("express")
const router = express.Router()

const { getConsolidated } = require("../controllers/consolidatedDataController")

router.get("/", getConsolidated)

module.exports = router
