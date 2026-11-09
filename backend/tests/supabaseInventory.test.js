import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

describe('coordinated recipe adapter (mocked database)', () => {
  let access, rpc, from, service, context
  const productId = '00000000-0000-4000-8000-000000000020'
  const inventoryId = '00000000-0000-4000-8000-000000000010'
  const body = () => ({ table: 'product_recipes', action: 'update', columns: '*', orders: [],
    filters: [{ column: 'product_id', op: 'eq', value: productId }, { column: 'inventory_id', op: 'eq', value: inventoryId }],
    values: { qty_per_sale: '0.000000000000123456789' }, expectedUnitVersion: '1', baseRecipeQty: '0.025', single: true })
  beforeEach(() => {
    access = require('../src/services/accessService')
    rpc = vi.fn().mockResolvedValue({ data: { product_id: productId, qty_per_sale: '0.000000000000123456789' }, error: null })
    from = vi.fn()
    vi.spyOn(access, 'database').mockReturnValue({ rpc, from })
    service = require('../src/services/recipeService')
    context = { user: { role: 'admin', permissions: ['pos'] }, tokenHash: 'synthetic-hash' }
  })
  afterEach(() => vi.restoreAllMocks())

  test('routes the bounded adapter through the authenticated recipe RPC', async () => {
    const result = await require('../src/routes/dataRoute').execute(context.user, body(), context)
    expect(result.qty_per_sale).toBe('0.000000000000123456789')
    expect(rpc).toHaveBeenCalledWith('jowen_recipe_command', { p_session_hash: 'synthetic-hash',
      p_data: { action: 'update', productId, inventoryId, quantity: '0.000000000000123456789', expectedUnitVersion: '1', baseRecipeQty: '0.025' } })
    expect(from).not.toHaveBeenCalled()
  })
  test.each(['cashier', 'stockist'])('rejects %s before database access', async role => {
    await expect(service.execute({ ...context, user: { role, permissions: ['pos'] } }, body())).rejects.toMatchObject({ statusCode: 403 })
    expect(rpc).not.toHaveBeenCalled()
  })
  test.each([
    { filters: [] }, { filters: [{ column: 'product_id', op: 'in', value: [productId] }] },
    { values: { inventory_id: inventoryId, qty_per_sale: '1' } }, { expectedUnitVersion: '1.0' },
    { expectedUnitVersion: '9223372036854775808' }, { values: { qty_per_sale: 'Infinity' } },
  ])('rejects widened or unsafe recipe mutations %j', async changes => {
    await expect(service.execute(context, { ...body(), ...changes })).rejects.toMatchObject({ statusCode: 400 })
    expect(rpc).not.toHaveBeenCalled()
  })
  test('fails closed if foundation exists but recipe RPC is absent', async () => {
    rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
    const q = { select: () => q, eq: () => q, single: async () => ({ data: { id: inventoryId, is_active: true, unit_version: 0 } }) }
    from.mockReturnValue(q)
    await expect(service.execute(context, body())).rejects.toMatchObject({ statusCode: 503 })
    expect(from).toHaveBeenCalledTimes(1)
  })
  test('supports the old schema only when unit-version fields are absent', async () => {
    rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
    const read = { select: () => read, eq: () => read, single: async () => ({ data: { id: inventoryId, is_active: true } }) }
    const write = { update: vi.fn(() => write), eq: vi.fn(() => write), select: async () => ({ data: [{ qty_per_sale: '0.03' }] }) }
    from.mockReturnValueOnce(read).mockReturnValueOnce(write)
    const oldBody = { ...body(), expectedUnitVersion: undefined, values: { qty_per_sale: '0.03' } }
    expect((await service.execute(context, oldBody)).qty_per_sale).toBe('0.03')
    expect(write.eq).toHaveBeenCalledWith('qty_per_sale', '0.025')
  })
  test('does not fall back after an RPC unit conflict', async () => {
    rpc.mockResolvedValue({ error: { message: 'UNIT_VERSION_CONFLICT' } })
    await expect(service.execute(context, body())).rejects.toMatchObject({ statusCode: 409 })
    expect(from).not.toHaveBeenCalled()
  })
})

const inventoryStore = require('../src/services/inventorySupabaseStore')
const { __setSupabaseClient, getAllInventory, getInventoryById } = inventoryStore

describe('Supabase Inventory Store', () => {
  test('calls supabase and returns all inventory rows', async () => {
    const mockData = [
      { id: 'I-001', name: 'Coffee Beans', category: 'Beverage', inStock: 25 },
      { id: 'I-002', name: 'Milk', category: 'Dairy', inStock: 10 },
    ]

    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    })

    __setSupabaseClient(() => ({ from: fromMock }))

    const data = await getAllInventory()

    expect(fromMock).toHaveBeenCalledWith('inventory')
    expect(data).toEqual(mockData)
  })

  test('returns specific inventory row by id using eq + single', async () => {
    const mockRow = { id: 'I-001', name: 'Coffee Beans' }

    const singleChain = vi.fn().mockResolvedValue({ data: mockRow, error: null })

    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: singleChain }),
      }),
    })

    __setSupabaseClient(() => ({ from: fromMock }))

    const data = await getInventoryById('I-001')

    expect(fromMock).toHaveBeenCalledWith('inventory')
    expect(data).toEqual(mockRow)
  })

  test('throws an error when supabase returns an error for list', async () => {
    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'RLS blocked', statusCode: 401 },
      }),
    })

    __setSupabaseClient(() => ({ from: fromMock }))

    await expect(getAllInventory()).rejects.toThrow('RLS blocked')
  })
})

describe('authenticated inventory command validation (mocked database)', () => {
  let app, rpc
  beforeEach(() => {
    const express = require('express')
    const access = require('../src/services/accessService')
    rpc = vi.fn().mockResolvedValue({ data: { id: 'item', unit_price: 1.25 }, error: null })
    vi.spyOn(access, 'database').mockReturnValue({ rpc })
    app = express()
    app.use(express.json())
    app.use((req, res, next) => {
      req.user = { role: req.get('x-test-role') || 'stockist', permissions: req.get('x-test-deny') ? [] : ['inventory'] }
      req.auth = { tokenHash: 'test-session-hash', user: req.user }
      next()
    })
    app.use(require('../src/routes/commandRoute'))
    app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ error: err.message }))
  })
  afterEach(() => vi.restoreAllMocks())

  test('passes fractional stock and unit pricing through the protected command', async () => {
    const request = require('supertest')
    const body = { action: 'update', id: 'item', operationKey: 'op-1', baseStockQty: 8, values: { stock_quantity: 7.125, unit_price: 85.2, unit: 'L' } }
    const result = await request(app).post('/inventory').send(body)
    expect(result.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('jowen_inventory_command', { p_session_hash: 'test-session-hash', p_data: body })
  })

  test('retains a decimal-string unit version on an inventory command', async () => {
    const body = { action: 'update', id: 'item', operationKey: 'versioned', expectedUnitVersion: '123456789012345678', values: { name: 'Flour' } }
    expect((await require('supertest')(app).post('/inventory').send(body)).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('jowen_inventory_command', { p_session_hash: 'test-session-hash', p_data: body })
  })

  test.each([null, -1, 0.5, '01', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1])('rejects invalid unit versions: %s', async expectedUnitVersion => {
    expect((await require('supertest')(app).post('/inventory').send({ action: 'archive', id: 'item', operationKey: 'bad-version', expectedUnitVersion })).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  test.each([0, null])('accepts explicit unit price %s without substituting an unknown price', async unit_price => {
    const request = require('supertest')
    expect((await request(app).post('/inventory').send({ action: 'create', operationKey: 'op-2', values: { name: 'Cups', stock_quantity: 0, unit: 'pcs', unit_price } })).status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  test.each([{ unit_price: -1 }, { unit_price: 1.001 }, { unit_price: 'NaN' }, { unit_price: '' }, { unit_price: true }, { unit_price: 10000000000 }, { stock_quantity: null }, { stock_quantity: '' }, { stock_quantity: false }, { unit: '' }, { unit: null }, { total_amount: 12 }])('rejects unsafe fields %j before database access', async values => {
    const request = require('supertest')
    const result = await request(app).post('/inventory').send({ action: 'update', id: 'item', operationKey: 'op-3', baseStockQty: 8, values })
    expect(result.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
  test.each([{ 'x-test-role': 'cashier' }, { 'x-test-deny': 'yes' }])('denies inventory writes without the required access: %j', async headers => {
    const request = require('supertest')
    const result = await request(app).post('/inventory').set(headers).send({ action: 'update', id: 'item', operationKey: 'op-4', values: { unit_price: 10 } })
    expect(result.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  const ingredientId = '00000000-0000-4000-8000-000000000001'
  const previewKey = 'unit-preview:00000000-0000-4000-8000-000000000031'
  const previewDigest = 'a'.repeat(64)
  const confirmBody = { previewKey, previewDigest, operationKey: 'convert-once' }

  test('previews through the admin RPC without rounding exact quantities or prices', async () => {
    const resultData = { previewKey, previewDigest, confirmationAvailable: false,
      quote: { quantityBefore: '7.125', quantityAfter: '7125', priceAfter: '0.0852' } }
    rpc.mockResolvedValueOnce({ data: resultData, error: null })
    const response = await require('supertest')(app).post(`/inventory/${ingredientId}/unit-change/preview`)
      .set('x-test-role', 'admin').send({ targetUnit: 'g', reason: '  Use grams  ' })
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(resultData)
    expect(rpc).toHaveBeenCalledWith('jowen_inventory_unit_change', { p_session_hash: 'test-session-hash',
      p_data: { action: 'preview', id: ingredientId, targetUnit: 'g', kind: 'conversion', reason: 'Use grams' } })
  })

  test.each(['cashier', 'stockist'])('denies %s unit preview and confirmation before RPC access', async role => {
    for (const action of ['preview', 'confirm']) {
      const response = await require('supertest')(app).post(`/inventory/${ingredientId}/unit-change/${action}`)
        .set('x-test-role', role).send(action === 'preview' ? { targetUnit: 'g', reason: 'Convert' } : confirmBody)
      expect(response.status).toBe(403)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  test.each([
    { targetUnit: 'pcs', reason: 'Convert' },
    { targetUnit: 'g', kind: 'arbitrary', reason: 'Convert' },
    { targetUnit: 'g', reason: '' },
    { targetUnit: 'g', reason: 'x'.repeat(1001) },
    { targetUnit: 'g', reason: 'Convert', factor: 999 },
  ])('rejects unsafe preview fields before RPC access: %j', async body => {
    const response = await require('supertest')(app).post(`/inventory/${ingredientId}/unit-change/preview`)
      .set('x-test-role', 'admin').send(body)
    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  test('sends only the issued receipt and retry key when confirming', async () => {
    const response = await require('supertest')(app).post(`/inventory/${ingredientId}/unit-change/confirm`)
      .set('x-test-role', 'admin').send(confirmBody)
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('jowen_inventory_unit_change', { p_session_hash: 'test-session-hash',
      p_data: { action: 'confirm', id: ingredientId, ...confirmBody } })
  })

  test.each([
    { ...confirmBody, quantityAfter: '0' }, { ...confirmBody, previewDigest: 'wrong' },
    { ...confirmBody, previewKey: 'another-key' }, { ...confirmBody, operationKey: '' },
    { ...confirmBody, operationKey: previewKey }, { ...confirmBody, operationKey: 'x'.repeat(129) },
  ])('rejects altered or incomplete confirmations: %j', async body => {
    const response = await require('supertest')(app).post(`/inventory/${ingredientId}/unit-change/confirm`)
      .set('x-test-role', 'admin').send(body)
    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  test.each([
    [{ code: 'PGRST202', message: 'Function not found' }, 503],
    [{ message: 'UNIT_CONVERSION_NOT_READY' }, 503],
    [{ message: 'UNIT_PREVIEW_CHANGED' }, 409],
    [{ message: 'UNIT_PREVIEW_EXPIRED' }, 409],
    [{ message: 'UNIT_SOURCE_REVIEW_REQUIRED' }, 409],
    [{ message: 'AUTH_REQUIRED' }, 401],
    [{ message: 'FORBIDDEN_UNIT_CHANGE' }, 403],
    [{ code: '55P03', message: 'Lock unavailable' }, 409],
  ])('maps unit-command errors safely: %j', async (error, status) => {
    rpc.mockResolvedValueOnce({ data: null, error })
    const response = await require('supertest')(app).post(`/inventory/${ingredientId}/unit-change/confirm`)
      .set('x-test-role', 'admin').send(confirmBody)
    expect(response.status).toBe(status)
    expect(response.body.error).not.toContain('Function not found')
  })
})

