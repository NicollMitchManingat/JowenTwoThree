const express = require('express')
const inventoryRouter = require('./routes/inventory')
const alertsRouter = require('./routes/alerts')

const app = express()
app.use(express.json())

app.get('/', (req, res) => res.json({ status: 'ok' }))
app.use('/api/inventory', inventoryRouter)
app.use('/api/inventory/alerts', alertsRouter)

module.exports = app

