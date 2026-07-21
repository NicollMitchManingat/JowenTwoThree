import { describe, test, expect, vi, beforeEach } from 'vitest'

const supabaseClient = require('../../src/services/supabaseClient')
const { listInventory } = require('../../src/services/inventoryRetrievalService')

function createListBuilder({ data = [], error = null } = {}) {
  return {
    select: vi.fn(() => Promise.resolve({ data, error })),
  }
}

function mockSupabaseWith(builder) {
  vi.spyOn(supabaseClient, 'supabase', 'get').mockReturnValue({
    from: vi.fn((table) => {
      if (table === 'inventory_items') return builder
      throw new Error(`Unexpected table in test: ${table}`)
    }),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

const sampleRows = [
  { id: 'I-001', item_name: 'Flour', unit: 'kg', current_stock: 20, category_id: 'C-1', inventory_categories: { name: 'Baking' } },
  { id: 'I-002', item_name: 'Milk', unit: 'l', current_stock: 3, category_id: 'C-2', inventory_categories: { name: 'Dairy' } },
  { id: 'I-003', item_name: 'Eggs', unit: 'pcs', current_stock: 0, category_id: 'C-2', inventory_categories: null },
  { id: 'I-004', item_name: 'Sugar', unit: 'kg', current_stock: 8, category_id: 'C-1', inventory_categories: { name: 'Baking' } },
]

describe('inventoryRetrievalService.listInventory', () => {
  test('throws 500 when supabase is not configured', async () => {
    vi.spyOn(supabaseClient, 'supabase', 'get').mockReturnValue(null)

    await expect(listInventory()).rejects.toMatchObject({ statusCode: 500 })
  })

  test('throws 500 when the fetch fails', async () => {
    mockSupabaseWith(createListBuilder({ data: null, error: { message: 'DB error' } }))

    await expect(listInventory()).rejects.toMatchObject({ statusCode: 500 })
  })

  test('maps rows and computes status correctly for all thresholds', async () => {
    mockSupabaseWith(createListBuilder({ data: sampleRows, error: null }))

    const result = await listInventory()

    expect(result).toHaveLength(4)
    expect(result).toContainEqual({ id: 'I-001', name: 'Flour', category: 'Baking', inStock: 20, status: 'Good' })
    expect(result).toContainEqual({ id: 'I-002', name: 'Milk', category: 'Dairy', inStock: 3, status: 'Low' })
    expect(result).toContainEqual({ id: 'I-003', name: 'Eggs', category: '', inStock: 0, status: 'OutOfStock' })
    expect(result).toContainEqual({ id: 'I-004', name: 'Sugar', category: 'Baking', inStock: 8, status: 'NearingExpiration' })
  })

  test('filters by category', async () => {
    mockSupabaseWith(createListBuilder({ data: sampleRows, error: null }))

    const result = await listInventory({ category: 'Baking' })

    expect(result).toHaveLength(2)
    expect(result.every((item) => item.category === 'Baking')).toBe(true)
  })

  test('filters by keyword matching item name (case-insensitive)', async () => {
    mockSupabaseWith(createListBuilder({ data: sampleRows, error: null }))

    const result = await listInventory({ q: 'MIlK' })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('I-002')
  })

  test('filters by keyword matching item id', async () => {
    mockSupabaseWith(createListBuilder({ data: sampleRows, error: null }))

    const result = await listInventory({ q: 'i-003' })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Eggs')
  })

  test('combines category and keyword filters', async () => {
    mockSupabaseWith(createListBuilder({ data: sampleRows, error: null }))

    const result = await listInventory({ category: 'Baking', q: 'sugar' })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('I-004')
  })

  test('returns an empty array when no rows match the filters', async () => {
    mockSupabaseWith(createListBuilder({ data: sampleRows, error: null }))

    const result = await listInventory({ q: 'nonexistent-item' })

    expect(result).toEqual([])
  })

  test('returns an empty array when the table has no rows', async () => {
    mockSupabaseWith(createListBuilder({ data: [], error: null }))

    const result = await listInventory()

    expect(result).toEqual([])
  })

  test('reflects updated stock immediately after a deduction (sync check)', async () => {
    const sharedRow = {
      id: 'I-010',
      item_name: 'Butter',
      unit: 'kg',
      current_stock: 12,
      category_id: 'C-1',
      inventory_categories: { name: 'Dairy' },
    }

    mockSupabaseWith(createListBuilder({ data: [sharedRow], error: null }))

    const before = await listInventory()
    expect(before[0].inStock).toBe(12)

    sharedRow.current_stock = 8

    const after = await listInventory()
    expect(after[0].inStock).toBe(8)
    expect(after[0].status).toBe('NearingExpiration')
  })
})

