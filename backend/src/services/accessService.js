const crypto = require('crypto')
const { supabase } = require('../config/supabaseClient')
const MODULES = ['pos', 'inventory', 'transactions', 'analytics', 'settings']
const VALID_ROLES = ['admin', 'cashier', 'stockist']
const PUBLIC_COLUMNS = 'id,username,full_name,role,is_active'
const httpError = (message, statusCode = 400, code) => Object.assign(new Error(message), { statusCode, code })
function database() {
  if (!supabase) throw httpError('Account service is not configured', 503)
  return supabase
}
function check(result) {
  if (result.error) throw httpError('Database operation failed. Please retry.', 503)
  return result.data
}
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex')
function publicUser(row, permissions = []) {
  return { id: row.id, username: row.username, fullName: row.full_name,
    role: row.role, isActive: row.is_active, permissions: row.role === 'admin' ? [...MODULES] : permissions }
}
async function userById(id) {
  const row = check(await database().from('app_users').select(PUBLIC_COLUMNS).eq('id', id).single())
  if (!row?.is_active) throw httpError('Please sign in again', 401)
  const grants = check(await database().from('app_user_module_permissions').select('module_key').eq('user_id', id))
  return publicUser(row, (grants || []).map(g => g.module_key))
}
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  check(await database().from('auth_sessions').insert({ user_id: userId,
    token_hash: hashToken(token), expires_at: new Date(Date.now() + 8 * 3600000).toISOString() }))
  return token
}
async function authenticate(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw httpError('Please sign in', 401)
  const tokenHash = hashToken(token)
  const { data, error } = await database().from('auth_sessions').select('id,user_id')
    .eq('token_hash', tokenHash).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) throw httpError('Session service is unavailable', 503)
  if (!data) throw httpError('Your session has expired. Please sign in again.', 401)
  return { user: await userById(data.user_id), sessionId: data.id, tokenHash }
}
async function revoke(sessionId) {
  check(await database().from('auth_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', sessionId))
}
const hasModule = (user, ...modules) => user?.isActive !== false &&
  (user?.role === 'admin' || modules.some(m => user?.permissions?.includes(m)))
function requireModules(user, ...modules) {
  if (!hasModule(user, ...modules)) throw httpError('You do not have access to this module', 403)
}
function requireAdmin(user) {
  if (user?.role !== 'admin' || user.isActive === false) throw httpError('Administrator access is required', 403)
}
module.exports = { MODULES, VALID_ROLES, PUBLIC_COLUMNS, httpError, database, check,
  hashToken, publicUser, userById, createSession, authenticate, revoke, hasModule, requireModules, requireAdmin }
