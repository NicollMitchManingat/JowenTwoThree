const access = require('../services/accessService')
const { URL } = require('url')
const COOKIE = 'jowen_session'
function allowedOrigin(req, origin) {
  if (!origin) return true
  try {
    const url = new URL(origin), host = req.get('host')
    return url.host === host || (process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol))
  } catch { return false }
}
async function authenticate(req, res, next) {
  try {
    const value = (req.headers.cookie || '').split(';').map(v => v.trim())
      .find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1)
    req.auth = await access.authenticate(value)
    req.user = req.auth.user
    next()
  } catch (err) { next(err) }
}
const modules = (...names) => (req, res, next) => {
  try { access.requireModules(req.user, ...names); next() } catch (err) { next(err) }
}
function admin(req, res, next) {
  try { access.requireAdmin(req.user); next() } catch (err) { next(err) }
}
function setCookie(req, res, token) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: token ? 8 * 3600000 : 0 })
}
function csrf(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !allowedOrigin(req, req.get('origin'))) {
    return res.status(403).json({ success: false, error: 'Request origin is not allowed' })
  }
  next()
}
const attempts = new Map()
function throttle(req, res, next, bucket = '') {
  const now = Date.now(), key = bucket || `${req.ip}:${req.path}`
  if (attempts.size > 10000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k)
  const value = attempts.get(key)
  if (!value || value.until < now) attempts.set(key, { count: 1, until: now + 60000 })
  else if (++value.count > 10) return res.status(429).json({ success: false, error: 'Too many attempts. Try again in a minute.' })
  next()
}
function passwordChangeThrottle(req, res, next) {
  if (!req.body?.password) return next()
  // Account-scoped across sessions/IPs so signing in again cannot reset attempts.
  return throttle(req, res, next, `password-change:${req.user.id}:${req.params.id.toLowerCase()}`)
}
module.exports = { authenticate, modules, admin, setCookie, csrf, throttle, passwordChangeThrottle, allowedOrigin }
