const express = require('express')
const inventoryRouter = require('./routes/inventory')
const authRouter = require('./routes/auth')

const app = express()
app.use(express.json())

app.get('/', (req, res) => res.json({ status: 'ok' }))
app.use('/api/inventory', inventoryRouter)
app.use('/api/auth', authRouter)

module.exports = app

