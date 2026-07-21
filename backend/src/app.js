const express = require("express")

const inventoryRouter = require("./routes/inventoryRoute")
const alertsRouter = require("./routes/alertsRoute")
const salesRouter = require("./routes/salesRoute")
const salesTrendRouter = require("./routes/salesTrendRoute")
const customerTrafficRouter = require("./routes/customerTrafficRoute")
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
app.use("/api/transactions", transactionRouter) // NEW

module.exports = app