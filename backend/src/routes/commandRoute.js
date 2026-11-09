const router = require('express').Router()
const a = require('../services/accessService')
const checkout = require('../services/checkoutService')
const auth = require('../services/authService')
const unitChanges = require('../services/unitConversionService')
const { modules, throttle, admin } = require('../middleware/authentication')
const run = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
router.post('/discount-approval', modules('pos'), throttle, run(async (req, res) => res.json(await checkout.approveDiscount(req.auth, req.body))))
router.post('/checkout', modules('pos'), run(async (req, res) => res.json(await checkout.checkout(req.auth, req.body))))
router.post('/save-order', modules('pos'), run(async (req, res) => res.json(await checkout.saveOrder(req.auth, req.body))))
router.get('/saved-orders', modules('pos', 'transactions'), run(async (req, res) => res.json({ orders: await checkout.listSavedOrders(req.user) })))
router.get('/saved-orders/count', modules('pos', 'transactions'), run(async (req, res) => res.json({ count: await checkout.countSavedOrders(req.user) })))
router.get('/saved-orders/:id', modules('pos'), run(async (req, res) => res.json({ order: await checkout.getSavedOrder(req.user, req.params.id) })))
router.post('/saved-orders/:id/remove', modules('pos', 'transactions'), run(async (req, res) => res.json({ removed: await checkout.removeSavedOrder(req.auth, req.params.id, req.body?.revision) })))
router.post('/inventory/:id/unit-change/preview', modules('inventory'), admin, throttle,
  run(async (req, res) => res.json({ data: await unitChanges.preview(req.auth, req.params.id, req.body) })))
router.post('/inventory/:id/unit-change/confirm', modules('inventory'), admin,
  run(async (req, res) => res.json({ data: await unitChanges.confirm(req.auth, req.params.id, req.body) })))
router.post('/inventory', modules('inventory'), run(async (req, res) => {
  if (!['admin', 'stockist'].includes(req.user.role)) throw a.httpError('Stockman access is required', 403)
  const body = req.body || {}, fields = body.values || {}
  if (!['create', 'update', 'archive'].includes(body.action) || typeof body.operationKey !== 'string' || !body.operationKey || body.operationKey.length > 128) throw a.httpError('Invalid inventory command')
  if (Array.isArray(fields) || typeof fields !== 'object' || Object.keys(fields).some(k => !['name', 'category', 'unit', 'stock_quantity', 'unit_price'].includes(k))) throw a.httpError('Invalid inventory fields')
  if (body.action === 'create' && (!fields.name || fields.stock_quantity == null)) throw a.httpError('Item name and quantity are required')
  const numericValue = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
  if (fields.name !== undefined && (typeof fields.name !== 'string' || !fields.name.trim())) throw a.httpError('Item name is required')
  if (fields.unit !== undefined && (typeof fields.unit !== 'string' || !fields.unit.trim() || fields.unit.trim().length > 32)) throw a.httpError('Unit of measurement is required (up to 32 characters)')
  if (fields.stock_quantity !== undefined && !numericValue(fields.stock_quantity)) throw a.httpError('Quantity must be a nonnegative number')
  const exactPrice = body.action === 'update' && /^[1-9]\d{0,18}$/.test(String(body.expectedUnitVersion))
  if (fields.unit_price !== undefined && fields.unit_price !== null && (!numericValue(fields.unit_price) ||
    !(exactPrice ? /^\d+(\.\d+)?$/ : /^\d+(\.\d{1,2})?$/).test(String(fields.unit_price)) || String(fields.unit_price).length > 128 || Number(fields.unit_price) > 9999999999.99)) throw a.httpError(exactPrice ? 'Price must be a finite nonnegative decimal within the supported range' : 'Price must be nonnegative, with at most two decimal places (maximum 9,999,999,999.99)')
  if (fields.stock_quantity !== undefined && body.action === 'update' && !numericValue(body.baseStockQty)) throw a.httpError('The current quantity is required')
  if (body.expectedUnitVersion !== undefined && (!['number','string'].includes(typeof body.expectedUnitVersion) ||
    !/^(0|[1-9]\d{0,18})$/.test(String(body.expectedUnitVersion)) || BigInt(body.expectedUnitVersion) > 9223372036854775807n ||
    (typeof body.expectedUnitVersion === 'number' && !Number.isSafeInteger(body.expectedUnitVersion)))) throw a.httpError('Invalid unit version')
  const result = await a.database().rpc('jowen_inventory_command', { p_session_hash: req.auth.tokenHash, p_data: req.body })
  if (result.error) throw checkout.rpcError(result.error)
  res.json({ data: result.data })
}))
router.post('/refund', modules('transactions'), throttle, run(async (req, res) => {
  if (req.user.role === 'stockist') throw a.httpError('Refund access is required', 403)
  const manager = req.user.role === 'admin' ? req.user : await auth.verifyManager({ password: req.body.managerPassword })
  const { transaction_id, items, refund_amount, reason, notes, operationKey } = req.body
  const result = await a.database().rpc('jowen_refund', { p_session_hash: req.auth.tokenHash,
    p_data: { action: 'refund', transaction_id, items, refund_amount, reason, notes, operationKey, approvedById: manager.id } })
  if (result.error) throw checkout.rpcError(result.error)
  res.json({ data: result.data })
}))
router.post('/shop-session', modules('pos'), throttle, run(async (req, res) => {
  const manager = req.user.role === 'admin' ? req.user : await auth.verifyManager({ password: req.body.managerPassword })
  const result = await a.database().rpc('jowen_session_command', { p_session_hash: req.auth.tokenHash, p_data: { ...req.body, approvedById: manager.id } })
  if (result.error) throw checkout.rpcError(result.error)
  res.json({ data: result.data })
}))
router.post('/traffic', modules('pos'), run(async (req, res) => {
  const counts = req.body || {}, parts = ['male', 'female', 'unspecified'].map(k => Number(counts[k] || 0))
  if (parts.some(n => !Number.isInteger(n) || n < 0 || n > 10000)) throw a.httpError('Invalid customer counts')
  const data = a.check(await a.database().from('customer_traffic').insert({ male_count: parts[0], female_count: parts[1], unspecified_count: parts[2], number_of_customer: parts.reduce((s, n) => s + n, 0) }).select().single())
  res.json({ data })
}))
router.get('/session-summary/:id', modules('settings', 'analytics'), run(async (req, res) => {
  const session = a.check(await a.database().from('sessions').select('id,started_at,ended_at').eq('id', req.params.id).single())
  const txns = a.check(await a.database().from('transactions').select('id,total,discount,status,male_count,female_count,unspecified_count').gte('created_at', session.started_at).lte('created_at', session.ended_at || new Date().toISOString()))
  const refunds = txns.length ? a.check(await a.database().from('refunds').select('transaction_id,refund_amount').in('transaction_id', txns.map(t => t.id))) : []
  res.json({ txns, refunds })
}))
module.exports = router
