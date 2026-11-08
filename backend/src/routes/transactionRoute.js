const router = require('express').Router()
const a = require('../services/accessService')
const { modules } = require('../middleware/authentication')
const service = require('../services/transactionService')
const checkout = require('../services/checkoutService')
const run = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
router.post('/', modules('pos'), run(async (req, res) => res.status(201).json({ success: true, ...(await checkout.checkout(req.auth, req.body)) })))
router.get(['/','/history'], modules('transactions'), run(async (req, res) => {
  const [paid, unpaid] = await Promise.all([service.getTransactionHistory(), checkout.listSavedOrders(req.user)])
  // A payment can land between the two reads. Prefer its paid row over a stale draft.
  const history = [...new Map([...unpaid, ...paid].map(row => [row.id, row])).values()]
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
  res.json({ success: true, history, transactions: history })
}))
router.post('/:id/refund', (req, res) => res.status(410).json({ error: 'Use the authenticated refund command with administrator approval' }))
router.get('/:id/receipt', run(async (req, res) => {
  const { data, error } = await a.database().from('transactions').select('*').eq('id', req.params.id).maybeSingle()
  if (error || !data) throw a.httpError('Transaction not found', 404)
  if (!a.hasModule(req.user, 'transactions') && data.created_by_user_id !== req.user.id) throw a.httpError('Receipt access is not allowed', 403)
  res.json({ success: true, transaction: data, receipt: service.formatReceipt(data) })
}))
module.exports = router
