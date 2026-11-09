// Deliberately bounded compatibility adapter for existing db.js reads. This is
// not a general Supabase proxy: resources, selections, filters and writes are fixed.
const router = require('express').Router()
const a = require('../services/accessService')
const recipes = require('../services/recipeService')
const unitReads = require('../services/inventorySupabaseStore')
const reads = {
  products: ['pos', 'inventory', 'analytics'], product_categories: ['pos', 'inventory', 'analytics'],
  inventory: ['inventory', 'pos', 'analytics'], product_recipes: ['pos', 'analytics'],
  discounts: ['pos', 'analytics'], transactions: ['transactions', 'analytics'],
  transaction_items: ['analytics'], refunds: ['transactions', 'analytics'],
  customer_traffic: ['pos', 'analytics'], sessions: ['pos', 'settings', 'analytics'],
  inventory_adjustments: ['inventory', 'analytics'],
}
const selections = {
  products: ['*', '*,product_categories(name)'], product_categories: ['*'], inventory: ['*'],
  product_recipes: ['*', 'product_id,inventory_id,qty_per_sale,inventory(id,name,stock_quantity)',
    '*,inventory(*)', '*,products(product_name),inventory(*)',
    'product_id,inventory_id,qty_per_sale,products(product_name),inventory(id,name,stock_quantity)'],
  transactions: ['*', 'id,created_at,subtotal,discount,total,payment_method,discount_type,discount_id,status,customer_count,male_count,female_count,unspecified_count',
    'created_at', 'id,created_at,total,status', 'created_at,total', 'created_at,cart',
    'created_at,customer_count,male_count,female_count,unspecified_count', 'created_at,customer_count',
    'id,total,customer_count,male_count,female_count,unspecified_count,status', 'total,customer_count'],
  customer_traffic: ['*', 'created_at,number_of_customer', 'number_of_customer,male_count,female_count,unspecified_count',
    'number_of_customer', 'created_at,number_of_customer,male_count,female_count,unspecified_count'],
  discounts: ['*', 'is_system', 'name,type,value'], refunds: ['*', 'refund_amount,created_at,transaction_id'],
  sessions: ['*'], transaction_items: ['quantity,product_id,products(product_name),transactions!inner(created_at)'],
  inventory_adjustments: ['*,inventory(name)'],
}
const filterColumns = new Set(['id', 'product_id', 'inventory_id', 'transaction_id', 'idempotency_key',
  'created_at', 'transactions.created_at', 'stock_quantity', 'status', 'ended_at'])
const orderColumns = new Set(['name', 'product_name', 'created_at', 'stock_quantity', 'is_system', 'started_at', 'product_id'])
const writeColumns = {
  products: ['product_name', 'selling_price', 'category_id', 'status'],
  product_recipes: ['product_id', 'inventory_id', 'qty_per_sale'],
  discounts: ['name', 'type', 'value', 'is_active'],
}
function validateQuery(body) {
  if (!Object.hasOwn(reads, body.table)) throw a.httpError('Unknown resource', 403)
  const columns = String(body.columns || '*').replace(/\s/g, '')
  if (!selections[body.table].includes(columns)) throw a.httpError('Selection is not allowed', 403)
  if (!Array.isArray(body.filters) || body.filters.length > 12) throw a.httpError('Invalid filters')
  for (const f of body.filters) {
    if (!filterColumns.has(f.column) || !['eq', 'gt', 'gte', 'lt', 'lte', 'is', 'in'].includes(f.op)) throw a.httpError('Invalid filter')
    if (f.op === 'in' && (!Array.isArray(f.value) || f.value.length > 1000)) throw a.httpError('Invalid filter values')
  }
  if (!Array.isArray(body.orders) || body.orders.length > 3 || body.orders.some(o => !orderColumns.has(o.column))) throw a.httpError('Invalid sort')
  return columns
}
async function execute(user, body, context) {
  const columns = validateQuery(body), { table, action = 'select', filters, orders } = body
  a.requireModules(user, ...reads[table])
  if (!['select', 'insert', 'update', 'delete'].includes(action)) throw a.httpError('Invalid operation', 403)
  if (table === 'product_recipes' && action !== 'select') return recipes.execute(context || { user }, body)
  let query = a.database().from(table)
  if (action !== 'select') {
    a.requireAdmin(user)
    if (!writeColumns[table]) throw a.httpError('Use the authorized command endpoint for this action', 403)
    if (action !== 'insert' && !filters.some(f => f.op === 'eq' && ['id', 'product_id'].includes(f.column))) throw a.httpError('A record identity is required')
    if (table === 'product_recipes' && action !== 'insert' && !filters.some(f => f.op === 'eq' && f.column === 'inventory_id')) throw a.httpError('Recipe ingredient identity is required')
    if (action === 'delete' && table !== 'product_recipes') throw a.httpError('Archive records instead of deleting them', 403)
    const data = body.values
    if (action !== 'delete' && (!data || Array.isArray(data) || Object.keys(data).some(k => !writeColumns[table].includes(k)))) throw a.httpError('Invalid update fields')
    if (table === 'discounts' && action === 'update') {
      const id = filters.find(f => f.column === 'id' && f.op === 'eq')?.value
      const row = a.check(await a.database().from('discounts').select('is_system,type,value').eq('id', id).single())
      if (row.is_system) throw a.httpError('System discounts cannot be changed', 403)
      if ((data.type || row.type) === 'percent' && Number(data.value ?? row.value) >= 100) throw a.httpError('Percentage must be below 100')
    }
    if (table === 'discounts') {
      if (data.value !== undefined && (!(Number(data.value) > 0) || (data.type === 'percent' && Number(data.value) >= 100))) throw a.httpError('Invalid discount value')
      if (action === 'insert') { data.created_by = user.username; data.is_system = false }
    }
    query = action === 'delete' ? query.delete() : query[action](data)
  }
  const start = Number.isInteger(body.start) && body.start >= 0 ? body.start : 0
  const count = Number.isInteger(body.count) && body.count > 0 ? Math.min(body.count, 5000) : 1000
  const build = versioned => {
    let selected = columns
    if (table === 'inventory') selected = unitReads.inventoryColumns(versioned)
    if (table === 'product_recipes') {
      selected = columns.startsWith('*') ? columns.replace('*', '*,qty_per_sale_text:qty_per_sale::text' +
        (versioned ? ',inventory_unit_version_text:inventory_unit_version::text' : ''))
        : columns.replace('qty_per_sale', 'qty_per_sale:qty_per_sale::text')
      selected = selected.replace('inventory(*)', 'inventory(' + unitReads.inventoryColumns(versioned) + ')')
    }
    // Rebuild only read builders on a metadata fallback; mutations never retry.
    let read = action === 'select' ? a.database().from(table) : query
    read = read.select(selected)
    if (table === 'inventory' && action === 'select') read = read.eq('is_active', true)
    for (const f of filters) read = read[f.op](f.column, f.value)
    for (const o of orders) read = read.order(o.column, { ascending: o.ascending !== false })
    read = read.range(start, start + count - 1)
    return body.single === true ? read.single() : read
  }
  const result = ['inventory','product_recipes'].includes(table) && action === 'select'
    ? await unitReads.readUnitRows(build) : await build(false)
  if (result.error) throw a.httpError('Data operation failed. Please retry.', 400)
  return result.data
}
router.post('/', async (req, res, next) => {
  try { res.json({ data: await execute(req.user, req.body || {}, req.auth) }) } catch (err) { next(err) }
})
module.exports = router
module.exports.execute = execute
module.exports.validateQuery = validateQuery
