const a = require('./accessService')
const checkout = require('./checkoutService')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function execute(context, body) {
  a.requireModules(context?.user, 'pos', 'analytics')
  a.requireAdmin(context?.user)
  if (!context?.tokenHash) throw a.httpError('Please sign in again.', 401)
  const { action, filters, values = {}, expectedUnitVersion, baseRecipeQty } = body
  if (!['insert', 'update', 'delete'].includes(action) || !Array.isArray(filters) ||
    !values || Array.isArray(values) || typeof values !== 'object' ||
    Object.keys(values).some(k => !['product_id', 'inventory_id', 'qty_per_sale'].includes(k))) throw a.httpError('Invalid recipe command')
  // Mutations address exactly one composite key. Never widen a delete/update.
  const identity = {}
  for (const f of filters) {
    if (f.op !== 'eq' || !['product_id', 'inventory_id'].includes(f.column) || identity[f.column]) throw a.httpError('Recipe identity is required')
    identity[f.column] = f.value
  }
  if (action === 'insert' && filters.length) throw a.httpError('Invalid recipe insert')
  if (action !== 'insert' && Object.keys(values).some(k => k !== 'qty_per_sale')) throw a.httpError('Recipe identities cannot be changed')
  const productId = action === 'insert' ? values.product_id : identity.product_id
  const inventoryId = action === 'insert' ? values.inventory_id : identity.inventory_id
  if (!UUID.test(productId || '') || !UUID.test(inventoryId || '')) throw a.httpError('Product and ingredient identities are required')
  const decimal = value => ['number', 'string'].includes(typeof value) && /^\d+(\.\d+)?$/.test(String(value)) && String(value).length <= 128 && Number(value) > 0 && Number.isFinite(Number(value))
  if (action !== 'delete' && !decimal(values.qty_per_sale)) throw a.httpError('Quantity per sale must be positive')
  if (baseRecipeQty !== undefined && !decimal(baseRecipeQty)) throw a.httpError('Invalid original recipe quantity')
  if (expectedUnitVersion !== undefined && (!['string','number'].includes(typeof expectedUnitVersion) ||
    !/^(0|[1-9]\d{0,18})$/.test(String(expectedUnitVersion)) || BigInt(expectedUnitVersion) > 9223372036854775807n ||
    (typeof expectedUnitVersion === 'number' && !Number.isSafeInteger(expectedUnitVersion)))) throw a.httpError('Invalid unit version')
  const data = { action, productId, inventoryId,
    ...(action === 'delete' ? {} : { quantity: String(values.qty_per_sale) }),
    ...(expectedUnitVersion === undefined ? {} : { expectedUnitVersion: String(expectedUnitVersion) }),
    ...(baseRecipeQty === undefined ? {} : { baseRecipeQty: String(baseRecipeQty) }) }
  const result = await a.database().rpc('jowen_recipe_command', { p_session_hash: context.tokenHash, p_data: data })
  if (!result.error) return body.single ? result.data : result.data ? [result.data] : []
  if (!['PGRST202','42883'].includes(result.error.code)) throw checkout.rpcError(result.error)

  // Deployment compatibility only: old databases have no foundation and cannot
  // convert units. Once version columns exist, a missing RPC must fail closed.
  // Release installation requires a write pause/drain; this is not a lock bridge.
  const item = a.check(await a.database().from('inventory').select('*').eq('id', inventoryId).single())
  if (!item || Object.hasOwn(item, 'unit_version')) throw a.httpError('Recipe coordination is not installed. Please retry after setup.', 503)
  if (expectedUnitVersion !== undefined && String(expectedUnitVersion) !== '0') throw a.httpError('Unit version changed. Reload recipes.', 409)
  if (!item.is_active) throw a.httpError('Ingredient is no longer available', 409)
  let query = a.database().from('product_recipes')
  query = action === 'delete' ? query.delete() : action === 'insert' ? query.insert(values) : query.update(values)
  if (action !== 'insert') {
    query = query.eq('product_id', productId).eq('inventory_id', inventoryId)
    if (baseRecipeQty !== undefined) query = query.eq('qty_per_sale', baseRecipeQty)
  }
  const rows = a.check(await query.select('*'))
  if (action !== 'insert' && !rows?.length) throw a.httpError('Recipe changed. Reload recipes before editing.', 409)
  return body.single ? rows[0] : rows
}
module.exports = { execute }
