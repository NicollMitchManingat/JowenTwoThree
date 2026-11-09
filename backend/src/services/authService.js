const bcrypt = require('bcryptjs')
const access = require('./accessService')
const { VALID_ROLES, MODULES, database, check, httpError } = access
async function login({ username, password }) {
  if (!String(username || '').trim() || !password) throw httpError('Username and password are required')
  const { data, error } = await database().from('app_users').select('*').eq('username', String(username).trim()).maybeSingle()
  if (error) throw httpError('Account service is unavailable', 503)
  if (!data || !data.is_active || !await bcrypt.compare(String(password), data.password_hash)) throw httpError('Invalid username or password', 401)
  return { success: true, user: await access.userById(data.id), token: await access.createSession(data.id) }
}
async function verifyManager({ password }) {
  if (!password) throw httpError('Admin password is required', 403)
  const rows = check(await database().from('app_users').select('id,username,password_hash').eq('role', 'admin').eq('is_active', true))
  for (const row of rows || []) {
    if (await bcrypt.compare(String(password), row.password_hash)) return { success: true, id: row.id, username: row.username }
  }
  throw httpError('Manager approval failed: incorrect admin password', 403)
}
function validateNewAccount(data, editing = false) {
  const username = String(data.username || '').trim()
  if (!username) throw httpError('Username is required')
  if (data.password != null && typeof data.password !== 'string') throw httpError('Password must be text')
  if ((!editing || data.password) && String(data.password || '').length < 6) throw httpError('Password must be at least 6 characters')
  if (!VALID_ROLES.includes(data.role)) throw httpError('Invalid account role')
  if (!Array.isArray(data.permissions) || data.permissions.some(m => !MODULES.includes(m))) throw httpError('Select valid access levels')
  return { username, fullName: String(data.fullName || '').trim() || username,
    role: data.role, permissions: [...new Set(data.permissions)] }
}
async function listAccounts(actor) {
  access.requireAdmin(actor)
  const rows = check(await database().from('app_users').select(access.PUBLIC_COLUMNS).order('username'))
  const grants = check(await database().from('app_user_module_permissions').select('user_id,module_key'))
  return (rows || []).map(row => access.publicUser(row, (grants || []).filter(g => g.user_id === row.id).map(g => g.module_key)))
}
async function saveAccount(id, data, auth) {
  access.requireAdmin(auth.user)
  let target
  if (id) target = check(await database().from('app_users').select(data.password ? `${access.PUBLIC_COLUMNS},password_hash` : access.PUBLIC_COLUMNS).eq('id', id).single())
  const grants = id ? check(await database().from('app_user_module_permissions').select('module_key').eq('user_id', id)) : []
  const clean = validateNewAccount({ username: target?.username, fullName: target?.full_name, role: target?.role,
    permissions: grants.map(g => g.module_key), ...data }, !!id)
  if (id && data.password) {
    if (typeof data.currentPassword !== 'string' || !data.currentPassword) throw httpError('Current password is required to change the password', 400, 'CURRENT_PASSWORD_REQUIRED')
    if (!target?.password_hash || !await bcrypt.compare(data.currentPassword, target.password_hash)) throw httpError('Current password is incorrect', 403, 'CURRENT_PASSWORD_INCORRECT')
  }
  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null
  const result = await database().rpc('jowen_save_account', { p_session_hash: auth.tokenHash, p_id: id || null,
    p_data: { username: clean.username, full_name: clean.fullName, role: clean.role, permissions: clean.permissions,
      password_hash: passwordHash, expected_password_hash: id && passwordHash ? target.password_hash : null,
      is_active: data.isActive ?? target?.is_active ?? true } })
  if (result.error) {
    if (result.error.message === 'PASSWORD_CHANGED') throw httpError('This account password changed. Enter its current password and try again.', 409, 'PASSWORD_CHANGED')
    if (result.error.message === 'CURRENT_PASSWORD_REQUIRED') throw httpError('Current password is required to change the password', 400, 'CURRENT_PASSWORD_REQUIRED')
    throw httpError(/unique|duplicate/i.test(result.error.message) ? 'Username is already taken' : result.error.message, 400)
  }
  return access.publicUser(result.data, clean.permissions)
}
module.exports = { login, verifyManager, validateNewAccount, listAccounts,
  createAccount: (data, auth) => saveAccount(null, data, auth),
  updateAccount: (id, data, auth) => saveAccount(id, data, auth), VALID_ROLES }
