import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

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
})

