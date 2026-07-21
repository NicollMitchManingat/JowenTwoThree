import { describe, test, expect, vi } from 'vitest'

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

