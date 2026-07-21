import { describe, test, expect, vi, afterEach } from 'vitest'

import stockDeductionService from '../../src/services/stockDeductionService'

const { deductStockForSale } = stockDeductionService

function createQueryBuilderMock({ data, error }) {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data, error })),
    then: (resolve) => resolve({ data, error }),
  }
  return builder
}

describe('stockDeductionService (supabase mocked)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('throws 409 when deduction would go below zero (supabase mode)', async () => {
    const current = 5

    const selectBuilder = createQueryBuilderMock({
      data: { id: 'I-002', item_name: 'Milk', current_stock: current },
      error: null,
    })
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })

    const inventorySupabaseStore = require('../../src/services/inventorySupabaseStore')
    if (typeof inventorySupabaseStore.__setSupabaseClient === 'function') {
      inventorySupabaseStore.__setSupabaseClient(() => ({
        from: () => selectBuilder,
      }))
    }

    const supabaseClient = require('../../src/services/supabaseClient')
    vi.spyOn(supabaseClient, 'getSupabase').mockImplementation(() => ({
      from: () => updateBuilder,
    }))

    await expect(
      deductStockForSale({
        itemId: 'I-002',
        quantity: current + 1,
        reason: 'POS_SALE',
        mode: 'supabase',
      })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  test('successfully deducts stock in supabase mode and calls update with the right value', async () => {
    const inventorySupabaseStore = require('../../src/services/inventorySupabaseStore')
    vi.spyOn(inventorySupabaseStore, 'getInventoryById').mockResolvedValue({
      id: 'I-010',
      item_name: 'Butter',
      current_stock: 12,
      category_name: 'Dairy',
    })

    const updateBuilder = {
      update: vi.fn(function () {
        return this
      }),
      eq: vi.fn(() => Promise.resolve({ error: null })),
    }

    const supabaseClient = require('../../src/services/supabaseClient')
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      from: vi.fn((table) => {
        if (table === 'inventory') return updateBuilder
        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const result = await deductStockForSale({
      itemId: 'I-010',
      quantity: 4,
      reason: 'POS_SALE',
      mode: 'supabase',
    })

    expect(updateBuilder.update).toHaveBeenCalledWith({ current_stock: 8 })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'I-010')
    expect(result).toMatchObject({
      id: 'I-010',
      name: 'Butter',
      category: 'Dairy',
      inStock: 8,
      status: 'NearingExpiration',
    })
  })

  test('throws 404 when the item is not found in supabase mode', async () => {
    const inventorySupabaseStore = require('../../src/services/inventorySupabaseStore')
    vi.spyOn(inventorySupabaseStore, 'getInventoryById').mockRejectedValue(
      Object.assign(new Error('Inventory item not found'), { statusCode: 404 })
    )

    await expect(
      deductStockForSale({
        itemId: 'I-999',
        quantity: 1,
        reason: 'POS_SALE',
        mode: 'supabase',
      })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})