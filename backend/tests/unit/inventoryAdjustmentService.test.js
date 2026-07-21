import { describe, test, expect, vi, beforeEach } from 'vitest'

const supabaseClient = require('../../src/services/supabaseClient')
const { updateInventoryById } = require('../../src/services/inventoryAdjustmentService')

function createFetchBuilder({ data = null, error = null } = {}) {
  const builder = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve({ data, error }))
  return builder
}

function createWriteBuilder({ error = null } = {}) {
  const builder = {}
  builder.update = vi.fn(() => builder)
  builder.eq = vi.fn(() => Promise.resolve({ error }))
  return builder
}

function createInsertBuilder({ error = null } = {}) {
  return {
    insert: vi.fn(() => Promise.resolve({ error })),
  }
}

function mockSupabaseFor({ fetch, write, insert }) {
  let itemsCallCount = 0
  vi.spyOn(supabaseClient, 'supabase', 'get').mockReturnValue({
    from: vi.fn((table) => {
      if (table === 'inventory_items') {
        itemsCallCount += 1
        return itemsCallCount === 1 ? fetch : write
      }
      if (table === 'inventory_movements') {
        return insert
      }
      throw new Error(`Unexpected table in test: ${table}`)
    }),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('inventoryAdjustmentService.updateInventoryById', () => {
  test('throws 500 when supabase is not configured', async () => {
    vi.spyOn(supabaseClient, 'supabase', 'get').mockReturnValue(null)

    await expect(
      updateInventoryById('I-001', { quantity: 5, reason: 'RESTOCK' })
    ).rejects.toMatchObject({ statusCode: 500 })
  })

  test('throws 400 when id is missing', async () => {
    vi.spyOn(supabaseClient, 'supabase', 'get').mockReturnValue({ from: vi.fn() })

    await expect(
      updateInventoryById(undefined, { quantity: 5, reason: 'RESTOCK' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  test('throws 400 when quantity is missing or not a number', async () => {
    vi.spyOn(supabaseClient, 'supabase', 'get').mockReturnValue({ from: vi.fn() })

    await expect(
      updateInventoryById('I-001', { quantity: undefined, reason: 'RESTOCK' })
    ).rejects.toMatchObject({ statusCode: 400 })

    await expect(
      updateInventoryById('I-001', { quantity: 'not-a-number', reason: 'RESTOCK' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  test('throws 400 when reason is missing or blank', async () => {
    vi.spyOn(supabaseClient, 'supabase', 'get').mockReturnValue({ from: vi.fn() })

    await expect(
      updateInventoryById('I-001', { quantity: 5, reason: '' })
    ).rejects.toMatchObject({ statusCode: 400 })

    await expect(
      updateInventoryById('I-001', { quantity: 5, reason: '   ' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  test('throws 404 when the item is not found (fetch error)', async () => {
    mockSupabaseFor({
      fetch: createFetchBuilder({ data: null, error: { message: 'Row not found' } }),
      write: createWriteBuilder(),
      insert: createInsertBuilder(),
    })

    await expect(
      updateInventoryById('I-999', { quantity: 5, reason: 'RESTOCK' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  test('increases stock and logs an IN movement', async () => {
    mockSupabaseFor({
      fetch: createFetchBuilder({
        data: { id: 'I-001', item_name: 'Flour', current_stock: 10, inventory_categories: { name: 'Baking' } },
        error: null,
      }),
      write: createWriteBuilder({ error: null }),
      insert: createInsertBuilder({ error: null }),
    })

    const result = await updateInventoryById('I-001', {
      quantity: 5,
      reason: 'RESTOCK',
      notes: 'Weekly delivery',
    })

    expect(result).toMatchObject({
      id: 'I-001',
      name: 'Flour',
      category: 'Baking',
      inStock: 15,
      status: 'Good',
    })
  })

  test('decreases stock and logs an OUT movement', async () => {
    mockSupabaseFor({
      fetch: createFetchBuilder({
        data: { id: 'I-002', item_name: 'Milk', current_stock: 8, inventory_categories: { name: 'Dairy' } },
        error: null,
      }),
      write: createWriteBuilder({ error: null }),
      insert: createInsertBuilder({ error: null }),
    })

    const result = await updateInventoryById('I-002', {
      quantity: -3,
      reason: 'DAMAGED',
    })

    expect(result.inStock).toBe(5)
    expect(result.status).toBe('Low')
  })

  test('computes status thresholds correctly', async () => {
    const cases = [
      { current: 4, delta: -4, expectedStock: 0, expectedStatus: 'OutOfStock' },
      { current: 10, delta: -7, expectedStock: 3, expectedStatus: 'Low' },
      { current: 10, delta: -2, expectedStock: 8, expectedStatus: 'NearingExpiration' },
      { current: 10, delta: 10, expectedStock: 20, expectedStatus: 'Good' },
    ]

    for (const c of cases) {
      mockSupabaseFor({
        fetch: createFetchBuilder({
          data: { id: 'I-003', item_name: 'Sugar', current_stock: c.current, inventory_categories: { name: 'Baking' } },
          error: null,
        }),
        write: createWriteBuilder({ error: null }),
        insert: createInsertBuilder({ error: null }),
      })

      const result = await updateInventoryById('I-003', {
        quantity: c.delta,
        reason: 'ADJUSTMENT',
      })

      expect(result.inStock).toBe(c.expectedStock)
      expect(result.status).toBe(c.expectedStatus)
    }
  })

  test('throws 500 when the stock update fails', async () => {
    mockSupabaseFor({
      fetch: createFetchBuilder({
        data: { id: 'I-001', item_name: 'Flour', current_stock: 10, inventory_categories: null },
        error: null,
      }),
      write: createWriteBuilder({ error: { message: 'DB write failed' } }),
      insert: createInsertBuilder(),
    })

    await expect(
      updateInventoryById('I-001', { quantity: 5, reason: 'RESTOCK' })
    ).rejects.toMatchObject({ statusCode: 500 })
  })

  test('throws 500 when logging the inventory movement fails', async () => {
    mockSupabaseFor({
      fetch: createFetchBuilder({
        data: { id: 'I-001', item_name: 'Flour', current_stock: 10, inventory_categories: null },
        error: null,
      }),
      write: createWriteBuilder({ error: null }),
      insert: createInsertBuilder({ error: { message: 'Movement insert failed' } }),
    })

    await expect(
      updateInventoryById('I-001', { quantity: 5, reason: 'RESTOCK' })
    ).rejects.toMatchObject({ statusCode: 500 })
  })

  test('falls back to empty category string when category is missing', async () => {
    mockSupabaseFor({
      fetch: createFetchBuilder({
        data: { id: 'I-004', item_name: 'Salt', current_stock: 10, inventory_categories: null },
        error: null,
      }),
      write: createWriteBuilder({ error: null }),
      insert: createInsertBuilder({ error: null }),
    })

    const result = await updateInventoryById('I-004', { quantity: 1, reason: 'RESTOCK' })

    expect(result.category).toBe('')
  })

  test('accepts quantity of 0 as a no-op adjustment logged as OUT movement', async () => {
    mockSupabaseFor({
      fetch: createFetchBuilder({
        data: { id: 'I-005', item_name: 'Pepper', current_stock: 6, inventory_categories: { name: 'Spices' } },
        error: null,
      }),
      write: createWriteBuilder({ error: null }),
      insert: createInsertBuilder({ error: null }),
    })

    const result = await updateInventoryById('I-005', { quantity: 0, reason: 'AUDIT' })

    expect(result.inStock).toBe(6)
    expect(result.status).toBe('NearingExpiration')
  })
})

