import { describe, test, expect, vi, beforeEach } from 'vitest'

function freshModules() {
  vi.resetModules()
  return {
    inventoryService: require('../../src/services/inventoryService'),
    inventoryStore: require('../../src/services/inventoryStore'),
    inventorySupabaseStore: require('../../src/services/inventorySupabaseStore'),
  }
}

describe('mapInventoryRow (category & stock resolution)', () => {
  test('prefers category_name over inventory_categories.name and row.category', () => {
    const { inventoryService } = freshModules()

    const row = {
      id: 'I-100',
      item_name: 'Test Item',
      current_stock: 7,
      category_name: 'CategoryName',
      inventory_categories: { name: 'NestedCategory' },
      category: 'FlatCategory',
    }

    expect(inventoryService.mapInventoryRow(row)).toEqual({
      id: 'I-100',
      name: 'Test Item',
      category: 'CategoryName',
      inStock: 7,
      status: 'NearingExpiration',
    })
  })

  test('falls back to inventory_categories.name when category_name is missing', () => {
    const { inventoryService } = freshModules()

    const row = {
      id: 'I-101',
      item_name: 'Test Item 2',
      current_stock: 3,
      inventory_categories: { name: 'NestedCategory' },
      category: 'FlatCategory',
    }

    expect(inventoryService.mapInventoryRow(row).category).toBe('NestedCategory')
  })

  test('falls back to row.category when category_name and inventory_categories are both missing', () => {
    const { inventoryService } = freshModules()

    const row = {
      id: 'I-102',
      item_name: 'Test Item 3',
      current_stock: 0,
      category: 'FlatCategory',
    }

    expect(inventoryService.mapInventoryRow(row).category).toBe('FlatCategory')
  })

  test('sets category to undefined when no category fields are present', () => {
    const { inventoryService } = freshModules()

    const row = { id: 'I-103', item_name: 'Test Item 4', current_stock: 2 }

    expect(inventoryService.mapInventoryRow(row).category).toBeUndefined()
  })

  test('parses current_stock into a number, falling back to in_stock then 0', () => {
    const { inventoryService } = freshModules()

    expect(
      inventoryService.mapInventoryRow({ id: 'A', item_name: 'x', current_stock: 15 }).inStock
    ).toBe(15)

    expect(
      inventoryService.mapInventoryRow({ id: 'B', item_name: 'x', in_stock: 4 }).inStock
    ).toBe(4)

    expect(
      inventoryService.mapInventoryRow({ id: 'C', item_name: 'x' }).inStock
    ).toBe(0)
  })

  test('computes status consistently with computeStatus for the resolved inStock', () => {
    const { inventoryService } = freshModules()

    const row = { id: 'I-104', item_name: 'Test Item 5', current_stock: 5 }
    const mapped = inventoryService.mapInventoryRow(row)

    expect(mapped.status).toBe(inventoryService.computeStatus(5))
  })
})

describe('inventoryService (unit)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('computeStatus', () => {
    test('returns OutOfStock when inStock is 0', () => {
      const { inventoryService } = freshModules()
      expect(inventoryService.computeStatus(0)).toBe('OutOfStock')
    })

    test('returns Low when inStock is <= 5', () => {
      const { inventoryService } = freshModules()
      expect(inventoryService.computeStatus(5)).toBe('Low')
      expect(inventoryService.computeStatus(1)).toBe('Low')
    })

    test('returns NearingExpiration when inStock is <= 10', () => {
      const { inventoryService } = freshModules()
      expect(inventoryService.computeStatus(10)).toBe('NearingExpiration')
      expect(inventoryService.computeStatus(6)).toBe('NearingExpiration')
    })

    test('returns Good when inStock is > 10', () => {
      const { inventoryService } = freshModules()
      expect(inventoryService.computeStatus(11)).toBe('Good')
    })
  })

  describe('listInventory', () => {
    test('maps supabase rows to API shape and computes status', async () => {
      const { inventoryService, inventorySupabaseStore } = freshModules()

      inventorySupabaseStore.__setSupabaseClient(() => ({
        from: () => ({
          select: async () => {
            return {
              data: [
                {
                  id: 'I-001',
                  item_name: 'Coffee Beans',
                  current_stock: 25,
                  inventory_categories: { name: 'Beverage' },
                },
              ],
              error: null,
            }
          },
        }),
      }))

      const result = await inventoryService.listInventory({})

      expect(result).toEqual([
        {
          id: 'I-001',
          name: 'Coffee Beans',
          category: 'Beverage',
          inStock: 25,
          status: 'Good',
        },
      ])
    })

    test('filters by category (case-sensitive after trim)', async () => {
      const { inventoryService, inventorySupabaseStore } = freshModules()

      inventorySupabaseStore.__setSupabaseClient(() => ({
        from: () => ({
          select: async () => {
            return {
              data: [
                {
                  id: 'I-001',
                  item_name: 'Coffee Beans',
                  current_stock: 25,
                  inventory_categories: { name: 'Beverage' },
                },
                {
                  id: 'I-002',
                  item_name: 'Milk',
                  current_stock: 10,
                  inventory_categories: { name: 'Dairy' },
                },
              ],
              error: null,
            }
          },
        }),
      }))

      const result = await inventoryService.listInventory({ category: 'Dairy' })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ id: 'I-002', category: 'Dairy' })
    })

    test('filters by keyword q (case-insensitive) over name and id', async () => {
      const { inventoryService, inventorySupabaseStore } = freshModules()

      inventorySupabaseStore.__setSupabaseClient(() => ({
        from: () => ({
          select: async () => {
            return {
              data: [
                {
                  id: 'I-001',
                  item_name: 'Coffee Beans',
                  current_stock: 25,
                  inventory_categories: { name: 'Beverage' },
                },
                {
                  id: 'I-ABC',
                  item_name: 'Milk Powder',
                  current_stock: 2,
                  inventory_categories: { name: 'Dairy' },
                },
              ],
              error: null,
            }
          },
        }),
      }))

      const resultByName = await inventoryService.listInventory({ q: 'milk' })
      expect(resultByName).toHaveLength(1)
      expect(resultByName[0].id).toBe('I-ABC')
      expect(resultByName[0].status).toBe('Low')

      const resultById = await inventoryService.listInventory({ q: 'i-001' })
      expect(resultById).toHaveLength(1)
      expect(resultById[0].id).toBe('I-001')
    })

    test('falls back to in-memory inventory when supabase throws', async () => {
      const { inventoryService, inventorySupabaseStore, inventoryStore } = freshModules()

      inventorySupabaseStore.__setSupabaseClient(() => {
        return {
          from: () => ({
            select: async () => {
              return {
                data: null,
                error: { message: 'RLS blocked', statusCode: 401 },
              }
            },
          }),
        }
      })

      const result = await inventoryService.listInventory({})

      expect(result).toEqual(inventoryStore.inventory)
    })

    test('prefers category_name over inventory_categories.name', async () => {
      const { inventoryService, inventorySupabaseStore } = freshModules()

      inventorySupabaseStore.__setSupabaseClient(() => ({
        from: () => ({
          select: async () => {
            return {
              data: [
                {
                  id: 'I-009',
                  item_name: 'Iced Tea',
                  current_stock: 12,
                  category_name: 'Beverage',
                  inventory_categories: { name: 'Drinks' },
                },
              ],
              error: null,
            }
          },
        }),
      }))

      const result = await inventoryService.listInventory({})
      expect(result).toEqual([
        {
          id: 'I-009',
          name: 'Iced Tea',
          category: 'Beverage',
          inStock: 12,
          status: 'Good',
        },
      ])
    })

    test('sets category from row.inventory_categories.name when category_name is missing', async () => {
      const { inventoryService, inventorySupabaseStore } = freshModules()

      inventorySupabaseStore.__setSupabaseClient(() => ({
        from: () => ({
          select: async () => {
            return {
              data: [
                {
                  id: 'I-010',
                  item_name: 'Green Tea',
                  current_stock: 3,
                  inventory_categories: { name: 'Beverage' },
                },
              ],
              error: null,
            }
          },
        }),
      }))

      const result = await inventoryService.listInventory({})
      expect(result).toEqual([
        {
          id: 'I-010',
          name: 'Green Tea',
          category: 'Beverage',
          inStock: 3,
          status: 'Low',
        },
      ])
    })

    test('falls back to row.category when category_name and inventory_categories are missing', async () => {
      const { inventoryService, inventorySupabaseStore } = freshModules()

      inventorySupabaseStore.__setSupabaseClient(() => ({
        from: () => ({
          select: async () => {
            return {
              data: [
                {
                  id: 'I-011',
                  item_name: 'Yogurt',
                  current_stock: 0,
                  category: 'Dairy',
                },
              ],
              error: null,
            }
          },
        }),
      }))

      const result = await inventoryService.listInventory({})
      expect(result).toEqual([
        {
          id: 'I-011',
          name: 'Yogurt',
          category: 'Dairy',
          inStock: 0,
          status: 'OutOfStock',
        },
      ])
    })
  })

  describe('updateInventoryById', () => {
    test('updates inStock and recomputes status on success', () => {
      const { inventoryService, inventoryStore } = freshModules()

      const before = inventoryStore.inventory.find((i) => i.id === 'I-002')
      expect(before.inStock).toBe(10)

      const updated = inventoryService.updateInventoryById('I-002', {
        quantity: 1,
        reason: 'restock',
        notes: 'optional',
      })

      expect(updated.inStock).toBe(11)
      expect(updated.status).toBe('Good')
    })

    test('throws 404 when id not found', () => {
      const { inventoryService } = freshModules()

      const err = () =>
        inventoryService.updateInventoryById('NOPE', { quantity: 1, reason: 'x' })

      expect(err).toThrow('Inventory item not found')
      try {
        err()
      } catch (e) {
        expect(e.statusCode).toBe(404)
      }
    })

    test('throws 400 when quantity is not a number', () => {
      const { inventoryService } = freshModules()

      expect(() =>
        inventoryService.updateInventoryById('I-001', { quantity: NaN, reason: 'x' })
      ).toThrow('`quantity` must be a number')

      try {
        inventoryService.updateInventoryById('I-001', { quantity: NaN, reason: 'x' })
      } catch (e) {
        expect(e.statusCode).toBe(400)
      }
    })

    test('throws 400 when reason missing/empty', () => {
      const { inventoryService } = freshModules()

      try {
        inventoryService.updateInventoryById('I-001', { quantity: 1, reason: '   ' })
      } catch (e) {
        expect(e.message).toBe('`reason` must be provided')
        expect(e.statusCode).toBe(400)
      }
    })
  })
})