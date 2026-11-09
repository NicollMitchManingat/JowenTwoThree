const router = require('express').Router()
const service = require('../services/authService')
const access = require('../services/accessService')
const auth = require('../middleware/authentication')
const run = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
router.post('/login', auth.throttle, run(async (req, res) => {
  const { token, ...result } = await service.login(req.body || {})
  auth.setCookie(req, res, token)
  res.json(result)
}))
router.use(auth.authenticate)
router.get('/me', (req, res) => res.json({ success: true, user: req.user }))
router.post('/logout', run(async (req, res) => {
  await access.revoke(req.auth.sessionId)
  auth.setCookie(req, res, '')
  res.json({ success: true })
}))
router.post('/verify-manager', auth.throttle, run(async (req, res) => res.json(await service.verifyManager(req.body || {}))))
router.get('/users', auth.admin, run(async (req, res) => res.json({ success: true, users: await service.listAccounts(req.user) })))
router.post('/users', auth.admin, run(async (req, res) => res.status(201).json({ success: true, user: await service.createAccount(req.body, req.auth) })))
router.patch('/users/:id', auth.admin, auth.passwordChangeThrottle, run(async (req, res) => {
  const user = await service.updateAccount(req.params.id, req.body, req.auth)
  const reauthenticate = req.params.id === req.user.id && !!req.body.password
  if (reauthenticate) auth.setCookie(req, res, '')
  res.json({ success: true, user, reauthenticate })
}))
module.exports = router
