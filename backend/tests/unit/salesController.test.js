import { describe, test, expect, vi, beforeEach } from 'vitest'

const stockDeductionService = require('../../src/services/stockDeductionService')
const { createSaleTransaction } = require('../../src/controllers/salesController')

function mockRes() {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

function mockReq(body) {
  return { body }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('salesController.createSaleTransaction', () => {
  test('returns 400 when orderId is missing', async () => {
    const req = mockReq({ items: [{ itemId: 'I-001', quantity: 1 }] })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
  })

  test('returns 400 when orderId is blank', async () => {
    const req = mockReq({ orderId: '   ', items: [{ itemId: 'I-001', quantity: 1 }] })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('returns 400 when items is missing', async () => {
    const req = mockReq({ orderId: 'ORD-1' })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
  })

  test('returns 400 when items is an empty array', async () => {
    const req = mockReq({ orderId: 'ORD-1', items: [] })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('returns 400 when an item is missing itemId', async () => {
    const req = mockReq({
      orderId: 'ORD-1',
      items: [{ quantity: 2 }],
    })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
  })

  test('returns 400 when an item has zero quantity', async () => {
    const req = mockReq({
      orderId: 'ORD-1',
      items: [{ itemId: 'I-001', quantity: 0 }],
    })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )
  })

  test('returns 400 when an item has negative quantity', async () => {
    const req = mockReq({
      orderId: 'ORD-1',
      items: [{ itemId: 'I-001', quantity: -3 }],
    })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('returns 400 when an item has a non-numeric quantity', async () => {
    const req = mockReq({
      orderId: 'ORD-1',
      items: [{ itemId: 'I-001', quantity: 'two' }],
    })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('single-item transaction succeeds (201)', async () => {
    vi.spyOn(stockDeductionService, 'deductStockForSale').mockResolvedValueOnce({
      id: 'I-001',
      name: 'Flour',
      category: 'Baking',
      inStock: 9,
      status: 'Good',
    })

    const req = mockReq({
      orderId: 'ORD-100',
      items: [{ itemId: 'I-001', quantity: 1, itemName: 'Flour' }],
    })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(stockDeductionService.deductStockForSale).toHaveBeenCalledTimes(1)
    expect(stockDeductionService.deductStockForSale).toHaveBeenCalledWith({
      itemId: 'I-001',
      quantity: 1,
      reason: 'POS_SALE',
      mode: 'memory',
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          orderId: 'ORD-100',
          items: [expect.objectContaining({ itemId: 'I-001', inStock: 9 })],
        }),
      })
    )
  })

  test('multi-item transaction succeeds when all items have enough stock', async () => {
    vi.spyOn(stockDeductionService, 'deductStockForSale')
      .mockResolvedValueOnce({
        id: 'I-001',
        name: 'Flour',
        category: 'Baking',
        inStock: 9,
        status: 'Good',
      })
      .mockResolvedValueOnce({
        id: 'I-002',
        name: 'Milk',
        category: 'Dairy',
        inStock: 4,
        status: 'Low',
      })

    const req = mockReq({
      orderId: 'ORD-101',
      items: [
        { itemId: 'I-001', quantity: 1, itemName: 'Flour' },
        { itemId: 'I-002', quantity: 2, itemName: 'Milk' },
      ],
    })
    const res = mockRes()

    await createSaleTransaction(req, res)

    expect(stockDeductionService.deductStockForSale).toHaveBeenCalledTimes(2)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          items: [
            expect.objectContaining({ itemId: 'I-001' }),
            expect.objectContaining({ itemId: 'I-002' }),
          ],
        }),
      })
    )
  })

  test('multi-item transaction: partial failure does NOT roll back earlier deductions (documents known gap)', async () => {
    const spy = vi.spyOn(stockDeductionService, 'deductStockForSale')
    // Item 1 succeeds (stock already deducted at this point)...
    spy.mockResolvedValueOnce({
      id: 'I-001',
      name: 'Flour',
      category: 'Baking',
      inStock: 9,
      status: 'Good',
    })
    // ...item 2 fails with insufficient stock.
    spy.mockRejectedValueOnce(
      Object.assign(new Error('Insufficient stock'), { statusCode: 409 })
    )

    const req = mockReq({
      orderId: 'ORD-102',
      items: [
        { itemId: 'I-001', quantity: 1, itemName: 'Flour' },
        { itemId: 'I-002', quantity: 999, itemName: 'Milk' },
      ],
    })
    const res = mockRes()

    await createSaleTransaction(req, res)

    // The overall transaction correctly reports failure...
    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    )

    // ...but item 1's deduction was already called and resolved successfully
    // BEFORE item 2 failed. There is no compensating call to undo it.
    // This test documents the known no-rollback limitation, not correct behavior.
    expect(stockDeductionService.deductStockForSale).toHaveBeenCalledTimes(2)
    expect(stockDeductionService.deductStockForSale).toHaveBeenNthCalledWith(1, {
      itemId: 'I-001',
      quantity: 1,
      reason: 'POS_SALE',
      mode: 'memory',
    })
  })
})

