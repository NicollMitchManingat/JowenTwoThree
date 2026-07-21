const express = require("express")
const router = express.Router()

const { exportCsv } = require("../controllers/csvExportController")

router.get("/", exportCsv)

module.exports = router
