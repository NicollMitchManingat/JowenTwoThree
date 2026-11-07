const crypto = require('crypto')
const a = require('./accessService')
const auth = require('./authService')
function integer(value, label, max = 10000) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > max) throw a.httpError(`Invalid ${label}`)
  return n
}
const cents = value => Math.round(Number(value) * 100)
async function quoteOrder(user, input) {
  a.requireModules(user, 'pos')
  if (!Array.isArray(input.cart) || input.cart.length > 100) throw a.httpError('Invalid cart')
  const key = String(input.orderKey || input.idempotency_key || '')
  if (!key || key.length > 128) throw a.httpError('An order key is required')
  const raw = input.cart.map(line => {
    const productId = String(line.productId || line.product_id || line.id || '')
    if (!/^[0-9a-f-]{36}$/i.test(productId)) throw a.httpError('Invalid product')
    const qty = integer(line.qty ?? line.quantity, 'quantity')
    if (!qty) throw a.httpError('Quantity must be positive')
    return { productId, qty, displayedPrice: Number(line.price), note: String(line.note || '').trim().slice(0, 1000) }
  })
  const products = raw.length ? a.check(await a.database().from('products')
    .select('id,product_name,selling_price,status').in('id', [...new Set(raw.map(i => i.productId))])) : []
  const cart = raw.map((line, index) => {
    const product = products.find(p => p.id === line.productId && p.status === 'ACTIVE')
    if (!product) throw a.httpError('A product is no longer available')
    if (!Number.isFinite(line.displayedPrice) || cents(line.displayedPrice) !== cents(product.selling_price)) throw a.httpError('A product price changed. Refresh the menu before checkout.', 409)
    return { productId: line.productId, qty: line.qty, note: line.note,
      name: product.product_name, price: cents(product.selling_price) / 100, cartItemId: `${line.productId}:${index}` }
  })
  const subtotalCents = cart.reduce((s, line) => s + cents(line.price) * line.qty, 0)
  if (subtotalCents > 9999999999) throw a.httpError('Order total is too large')
  const choice = input.discountType || 'none'
  if (typeof choice !== 'string') throw a.httpError('Invalid discount selection')
  let voucher = null
  if (choice !== 'none') {
    const names = { pwd: 'PWD', senior: 'Senior', promo: 'Promo' }
    let q = a.database().from('discounts').select('id,name,type,value,is_active')
    if (choice.startsWith('voucher:')) q = q.eq('id', choice.slice(8))
    else if (names[choice]) q = q.eq('name', names[choice])
    else throw a.httpError('Unknown discount')
    voucher = a.check(await q.single())
    if (!voucher?.is_active || Number(voucher.value) <= 0 || (voucher.type === 'percent' && Number(voucher.value) >= 100)) throw a.httpError('Discount is unavailable')
  }
  const discountCents = voucher ? Math.min(subtotalCents, voucher.type === 'flat' ? cents(voucher.value) : Math.round(subtotalCents * Number(voucher.value) / 100)) : 0
  const counts = input.counts || { unspecified: input.customerCount ?? input.customer_count ?? 0 }
  const gender = { male: integer(counts.male ?? 0, 'customer count'), female: integer(counts.female ?? 0, 'customer count'), unspecified: integer(counts.unspecified ?? 0, 'customer count') }
  if (!cart.length && !(gender.male + gender.female + gender.unspecified)) throw a.httpError('The order is empty')
  const quote = { orderKey: key, cart, subtotal: subtotalCents / 100, discount: discountCents / 100,
    total: (subtotalCents - discountCents) / 100, counts: gender,
    discountId: voucher?.id || null, discountKind: voucher?.type || null,
    discountValue: voucher ? Number(voucher.value) : 0, discountLabel: voucher?.name || 'None' }
  const digest = crypto.createHash('sha256').update(JSON.stringify({ userId: user.id, ...quote })).digest('hex')
  return { quote, digest }
}
async function approveDiscount(context, input) {
  const { quote, digest } = await quoteOrder(context.user, input)
  if (!quote.discount) throw a.httpError('Choose a discount before requesting approval')
  if (context.user.role === 'admin') return { approvalId: null, quote }
  const manager = await auth.verifyManager({ password: input.adminPassword })
  const row = a.check(await a.database().from('discount_approvals').insert({
    request_key: crypto.randomUUID(), order_key: quote.orderKey, order_revision: 0,
    cart_digest: digest, requested_by_user_id: context.user.id, approved_by_user_id: manager.id,
    discount_id: quote.discountId, approved_amount: quote.discount,
    expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
  }).select('id').single())
  return { approvalId: row.id, quote }
}
function rpcError(error) {
  const message = error.message || 'Operation failed'
  const status = /AUTH_REQUIRED/.test(message) ? 401 : /FORBIDDEN|APPROVAL/.test(message) ? 403 : /STOCK|CONFLICT|CHANGED/.test(message) ? 409 : 400
  const messages = [
    [/AUTH_REQUIRED/, 'Your session has expired. Please sign in again.'],
    [/FORBIDDEN/, 'You do not have permission for this action.'],
    [/APPROVAL/, 'Admin approval is missing or expired. Request approval again.'],
    [/INSUFFICIENT_STOCK/, 'Some ingredients are short of stock.'],
    [/CONFLICT_STOCK_CHANGED/, 'Stock changed while you were editing. Refresh the item and try again.'],
    [/CONFLICT_ORDER_KEY|CONFLICT_OPERATION_KEY/, 'This request was already submitted with different details. Check the saved record before retrying.'],
    [/CONFLICT_REFUND_QUANTITY/, 'The refundable quantity changed. Refresh this transaction.'],
    [/CONFLICT_SESSION_ALREADY_CLOSED/, 'This shop session is already closed. Refresh the page.'],
    [/CHANGED/, 'The order changed. Refresh the menu and request approval again.'],
  ]
  const friendly = messages.find(([pattern]) => pattern.test(message))?.[1] || message
  const err = a.httpError(friendly, status, /INSUFFICIENT_STOCK/.test(message) ? 'INSUFFICIENT_STOCK' : undefined)
  if (err.code) { try { err.shortfalls = JSON.parse(error.details) } catch { err.shortfalls = [] } }
  return err
}
async function checkout(context, input) {
  const { quote, digest } = await quoteOrder(context.user, input)
  const paymentMethod = input.paymentMethod || 'CASH'
  if (!['CASH', 'GCASH', 'CARD'].includes(paymentMethod)) throw a.httpError('Invalid payment method')
  const cash = paymentMethod !== 'CASH' || input.cashReceived === '' || input.cashReceived == null ? quote.total : Number(input.cashReceived)
  if (!Number.isFinite(cash) || cents(cash) < cents(quote.total)) throw a.httpError('Insufficient cash')
  const result = await a.database().rpc('jowen_checkout', { p_session_hash: context.tokenHash,
    p_data: { quote, digest, approvalId: input.approvalId || null,
      paymentMethod, cashReceived: cents(cash) / 100, allowShortage: input.allowShortage === true } })
  if (result.error) throw rpcError(result.error)
  return result.data
}
module.exports = { quoteOrder, approveDiscount, checkout, rpcError }
