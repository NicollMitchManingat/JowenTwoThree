const express = require("express")
const cors = require("cors")

const inventoryRouter = require("./routes/inventoryRoute")
const alertsRouter = require("./routes/alertsRoute")
const salesRouter = require("./routes/salesRoute")
const salesTrendRouter = require("./routes/salesTrendRoute")
const customerTrafficRouter = require("./routes/customerTrafficRoute")
const predictiveForecastRouter = require("./routes/predictiveForecastRoute")
const aiInsightsRouter = require("./routes/aiInsightsRoute")
const consolidatedDataRouter = require("./routes/consolidatedDataRoute")
const transactionRouter = require("./routes/transactionRoute") // NEW
const productRouter = require("./routes/productRoute");
const authRouter = require("./routes/auth");
const authentication = require('./middleware/authentication')
const dataRouter = require('./routes/dataRoute')
const commandRouter = require('./routes/commandRoute')

const app = express()

app.use(cors((req, done) => done(null, { origin: authentication.allowedOrigin(req, req.get('origin')) ? req.get('origin') || false : false, credentials: true })))
// Session-protected data and errors must never be reused across users or roles.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store')
  next()
})
app.use(express.json({ limit: '256kb' }))
app.use(authentication.csrf)

app.get("/", (req, res) =>
  res.json({
    status: "ok",
  })
)

app.use("/api/auth", authRouter);
app.use('/api', authentication.authenticate)
app.use('/api/data', dataRouter)
app.use('/api/commands', commandRouter)
app.use('/api/inventory/alerts', authentication.modules('pos', 'inventory'), alertsRouter)
app.use('/api/inventory', authentication.modules('inventory'), inventoryRouter)
app.use('/api/sales', authentication.modules('analytics'), salesRouter)
app.use('/api/sales/trend', authentication.modules('analytics'), salesTrendRouter)
app.use('/api/customer-traffic', authentication.modules('analytics'), customerTrafficRouter)
app.use('/api/predictive-forecast', authentication.modules('analytics'), predictiveForecastRouter)
app.use('/api/ai-insights', authentication.modules('analytics'), aiInsightsRouter)
app.use('/api/consolidated-data', authentication.modules('analytics'), consolidatedDataRouter)
app.use('/api/transactions', authentication.modules('transactions', 'pos'), transactionRouter)
app.use('/api/products', (req, res, next) => req.method === 'GET'
  ? authentication.modules('pos', 'inventory', 'analytics')(req, res, next)
  : authentication.admin(req, res, next), productRouter)
app.use((err, req, res, _next) => {
  const status = err.statusCode || 500
  res.status(status).json({ success: false, error: status === 500 ? 'Request failed. Please retry.' : err.message,
    code: err.code, shortfalls: err.shortfalls })
})

module.exports = app
