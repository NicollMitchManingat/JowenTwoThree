import { describe, test, expect, afterEach } from 'vitest'

const { inventory } = require('../../src/services/inventoryStore')
const { getSalesData } = require('../../src/services/salesService')
const { deductStockForSale } = require('../../src/services/stockDeductionService')

function pickTestItemId() {
  const { records } = getSalesData()
  const withInventory = records.find((r) => r.inventory)
  return withInventory ? withInventory.itemId : null
}

describe('salesService / inventory sync (documents current staleness behavior)', () => {
  let restoreId
  let restoreStock

  afterEach(() => {
    if (restoreId) {
      const idx = inventory.findIndex((i) => i.id === restoreId)
      if (idx !== -1) inventory[idx] = { ...inventory[idx], inStock: restoreStock }
    }
    restoreId = undefined
  })

  test('salesService inventory snapshot does not reflect a deduction made after module load', async () => {
    const itemId = pickTestItemId()

    if (!itemId) {
      return
    }

    const liveItem = inventory.find((i) => i.id === itemId)
    restoreId = itemId
    restoreStock = liveItem.inStock

    const before = getSalesData()
    const beforeRecord = before.records.find((r) => r.itemId === itemId)
    const staleStockBefore = beforeRecord.inventory.inStock

    await deductStockForSale({
      itemId,
      quantity: 1,
      reason: 'POS_SALE',
      mode: 'memory',
    })

    const updatedLiveItem = inventory.find((i) => i.id === itemId)
    expect(updatedLiveItem.inStock).toBe(restoreStock - 1)

    const after = getSalesData()
    const afterRecord = after.records.find((r) => r.itemId === itemId)
    expect(afterRecord.inventory.inStock).toBe(staleStockBefore)
  })
})