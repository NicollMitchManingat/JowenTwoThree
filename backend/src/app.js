const express = require("express")

const inventoryRouter = require("./routes/inventoryRoute")
const alertsRouter = require("./routes/alertsRoute")
const analyticsRouter = require("./routes/analyticsRoute")

const app = express()

app.use(express.json())

app.get("/", (req, res) => res.json({ status: "ok" }))

app.use("/api/inventory", inventoryRouter)
app.use("/api/inventory/alerts", alertsRouter)
app.use("/api/analytics", analyticsRouter)

module.exports = app