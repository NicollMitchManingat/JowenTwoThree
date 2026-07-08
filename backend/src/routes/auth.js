const express = require('express')
const router = express.Router()

const { login } = require('../services/authService')

router.post('/login', (req, res) => {
  const { username, email, password } = req.body || {}

  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username, email, and password are required'
    })
  }

  const result = login({ username, email, password })

  if (!result.success) {
    return res.status(401).json(result)
  }

  return res.status(200).json(result)
})

module.exports = router

