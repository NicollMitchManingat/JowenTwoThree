const express = require("express")

const inventoryRouter = require("./routes/inventoryRoute")
const alertsRouter = require("./routes/alertsRoute")
const salesRouter = require("./routes/salesRoute")
const salesTrendRouter = require("./routes/salesTrendRoute")
const customerTrafficRouter = require("./routes/customerTrafficRoute")
const predictiveForecastRouter = require("./routes/predictiveForecastRoute")
const consolidatedDataRouter = require("./routes/consolidatedDataRoute")
const csvExportRouter = require("./routes/csvExportRoute")
const transactionRouter = require("./routes/transactionRoute") // NEW

const app = express()

app.use(express.json())

app.get("/", (req, res) =>
  res.json({
    status: "ok",
  })
)

app.use("/api/inventory", inventoryRouter)
app.use("/api/inventory/alerts", alertsRouter)
app.use("/api/sales", salesRouter)
app.use("/api/sales/trend", salesTrendRouter)
app.use("/api/customer-traffic", customerTrafficRouter)
app.use("/api/predictive-forecast", predictiveForecastRouter)
app.use("/api/consolidated-data", consolidatedDataRouter)
app.use("/api/export/csv", csvExportRouter)
app.use("/api/transactions", transactionRouter) // NEW

module.exports = app