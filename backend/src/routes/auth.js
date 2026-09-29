const express = require('express')
const router = express.Router()

const AuthService = require('../services/authService')

// Every admin endpoint verifies the requesting admin's credentials per
// request (the app has no sessions/tokens). Body: { adminUsername, adminPassword, ...rest }.
function adminCredentials(req) {
  return {
    adminUsername: req.body?.adminUsername,
    adminPassword: req.body?.adminPassword,
  }
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    })
  }

  try {
    const result = await AuthService.login(req.body || {})

    if (!result.success) {
      return res.status(401).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Login Error:', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

// Manager (admin) password check for sensitive actions like refunds.
router.post('/verify-manager', async (req, res) => {
  try {
    const result = await AuthService.verifyManager(req.body || {})
    return res.status(result.success ? 200 : 401).json(result)
  } catch (error) {
    console.error('Verify Manager Error:', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/users', async (req, res) => {
  try {
    const users = await AuthService.listAccounts({
      adminUsername: req.query.adminUsername,
      adminPassword: req.query.adminPassword,
    })
    return res.status(200).json({ success: true, users })
  } catch (error) {
    const status = /approval|admin/i.test(error.message) ? 403 : 500
    console.error('List Users Error:', error)
    return res.status(status).json({ success: false, error: error.message })
  }
})

router.post('/users', async (req, res) => {
  try {
    const user = await AuthService.createAccount(req.body || {}, adminCredentials(req))
    return res.status(201).json({ success: true, message: 'Account created successfully', user })
  } catch (error) {
    const status = /required|taken|valid|least 6|must be one of|approval/i.test(error.message) ? 400 : 500
    console.error('Create User Error:', error)
    return res.status(status).json({ success: false, error: error.message })
  }
})

router.patch('/users/:id', async (req, res) => {
  try {
    const user = await AuthService.updateAccount(req.params.id, req.body || {}, adminCredentials(req))
    return res.status(200).json({ success: true, message: 'Account updated successfully', user })
  } catch (error) {
    const status = /not found/i.test(error.message)
      ? 404
      : /required|taken|valid|least 6|must be one of|nothing|demote|deactivate|approval/i.test(error.message)
        ? 400
        : 500
    console.error('Update User Error:', error)
    return res.status(status).json({ success: false, error: error.message })
  }
})

module.exports = router
