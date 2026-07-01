const express = require('express')
const inventoryRouter = require('./routes/inventory')

const app = express()
app.use(express.json())

app.get('/', (req, res) => res.json({ status: 'ok' }))
app.use('/api/inventory', inventoryRouter)

module.exports = app
