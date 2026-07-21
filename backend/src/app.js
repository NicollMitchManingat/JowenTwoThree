const express = require("express")
const cors = require("cors")

const inventoryRouter = require("./routes/inventoryRoute")
const alertsRouter = require("./routes/alertsRoute")
const salesRouter = require("./routes/salesRoute")
const salesTrendRouter = require("./routes/salesTrendRoute")
const customerTrafficRouter = require("./routes/customerTrafficRoute")
const predictiveForecastRouter = require("./routes/predictiveForecastRoute")
const consolidatedDataRouter = require("./routes/consolidatedDataRoute")
const csvExportRouter = require("./routes/csvExportRoute")
const transactionRouter = require("./routes/transactionRoute") // NEW
const productRouter = require("./routes/productRoute");

const app = express()

app.use(cors())
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
app.use("/api/products", productRouter);

module.exports = app