import { describe, test, expect } from 'vitest'

const stockDeductionService = require('../../src/services/stockDeductionService')
const { inventory } = require('../../src/services/inventoryStore')

const { deductStockForSale } = stockDeductionService

function restoreItem(itemId, inStock, status) {
  const idx = inventory.findIndex((i) => i.id === itemId)
  inventory[idx] = { ...inventory[idx], inStock, status }
}

describe('stockDeductionService (in-memory)', () => {
  test('deducts stock and clamps to zero for exact depletion', async () => {
    const before = inventory.find((i) => i.id === 'I-002')
    const start = before.inStock
    const startStatus = before.status

    const result = await deductStockForSale({
      itemId: 'I-002',
      quantity: start,
      reason: 'POS_SALE',
      mode: 'memory',
    })

    expect(result.inStock).toBe(0)
    expect(result.status).toBe('OutOfStock')

    const after = inventory.find((i) => i.id === 'I-002')
    expect(after.inStock).toBe(0)

    restoreItem('I-002', start, startStatus)
  })

  test('prevents stock deduction below zero (throws 409)', async () => {
    const before = inventory.find((i) => i.id === 'I-002')
    const start = before.inStock

    await expect(
      deductStockForSale({
        itemId: 'I-002',
        quantity: start + 1,
        reason: 'POS_SALE',
        mode: 'memory',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/insufficient stock/i),
    })

    const after = inventory.find((i) => i.id === 'I-002')
    expect(after.inStock).toBe(start)
  })

  test('multiple deductions keep accurate final stock', async () => {
    const itemId = 'I-001'
    const before = inventory.find((i) => i.id === itemId)
    const start = before.inStock
    const startStatus = before.status

    await deductStockForSale({ itemId, quantity: 3, reason: 'POS_SALE', mode: 'memory' })
    await deductStockForSale({ itemId, quantity: 4, reason: 'POS_SALE', mode: 'memory' })

    const after = inventory.find((i) => i.id === itemId)
    expect(after.inStock).toBe(start - 7)

    restoreItem(itemId, start, startStatus)
  })
})