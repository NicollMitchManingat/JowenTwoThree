import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveMenuCache, loadMenuCache, clearMenuCache } from '../services/menuCache'
import { saveStockCache, loadStockCache, clearStockCache } from '../services/stockCache'
import { db, isRetryableError, isQueuedRecord } from '../services/db'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

// Chainable PostgREST stub: every filter returns the builder, awaiting it
// resolves the canned { data, error } via an optional gate promise.
function chainable(resolveRows, onStart) {
  const builder = {}
  for (const m of ['select', 'gte', 'lte', 'order', 'range', 'in', 'eq', 'limit', 'abortSignal', 'update', 'insert', 'delete', 'single']) {
    builder[m] = vi.fn(() => builder)
  }
  builder.then = (resolve, reject) => {
    if (onStart) onStart()
    return Promise.resolve(resolveRows()).then(resolve, reject)
  }
  return builder
}

describe('menuCache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should round-trip a menu snapshot with a timestamp', () => {
    const products = [{ id: '1', name: 'Espresso', price: 150, category: 'Drinks' }]
    expect(saveMenuCache({ products, categories: ['All', 'Drinks'], discounts: [] })).toBe(true)

    const snap = loadMenuCache()
    expect(snap.products).toEqual(products)
    expect(snap.categories).toEqual(['All', 'Drinks'])
    expect(typeof snap.savedAt).toBe('string')
  })

  it('should refuse to save an empty menu', () => {
    expect(saveMenuCache({ products: [] })).toBe(false)
    expect(loadMenuCache()).toBe(null)
  })

  it('should return null for missing or corrupt snapshots', () => {
    expect(loadMenuCache()).toBe(null)
    localStorage.setItem('jowen-menu-cache', 'not-json{{{')
    expect(loadMenuCache()).toBe(null)
    localStorage.setItem('jowen-menu-cache', JSON.stringify({ products: [] }))
    expect(loadMenuCache()).toBe(null)
  })

  it('should clear the snapshot', () => {
    saveMenuCache({ products: [{ id: '1', name: 'Espresso', price: 150, category: 'Drinks' }] })
    clearMenuCache()
    expect(loadMenuCache()).toBe(null)
  })
})

describe('isRetryableError', () => {
  it('should flag timeouts, network failures, and 5xx as retryable', () => {
    expect(isRetryableError(new Error('Request timed out after 8s. Supabase may be waking up — please retry.'))).toBe(true)
    expect(isRetryableError(new Error('Failed to fetch'))).toBe(true)
    expect(isRetryableError({ code: 'NETWORK_ERROR' })).toBe(true)
    expect(isRetryableError({ status: 503, message: 'Service unavailable' })).toBe(true)
    expect(isRetryableError({ status: 504, message: 'Gateway timeout' })).toBe(true)
  })

  it('should not flag business or client errors', () => {
    expect(isRetryableError(null)).toBe(false)
    expect(isRetryableError(undefined)).toBe(false)
    expect(isRetryableError(new Error('That ingredient is already in this recipe — edit its quantity instead.'))).toBe(false)
    expect(isRetryableError({ code: 'INSUFFICIENT_STOCK' })).toBe(false)
    expect(isRetryableError({ status: 400, message: 'Bad request' })).toBe(false)
    expect(isRetryableError({ status: 401, message: 'JWT expired' })).toBe(false)
  })
})

describe('isQueuedRecord', () => {
  it('should detect queued optimistic records only', () => {
    expect(isQueuedRecord({ id: 'temp', _queued: true })).toBe(true)
    expect(isQueuedRecord({ id: 'real-uuid' })).toBe(false)
    expect(isQueuedRecord(null)).toBe(false)
  })
})

describe('stockCache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('should round-trip a stock snapshot with a timestamp', () => {
    const items = [{ id: 'i1', name: 'Milk', stock_quantity: 8 }]
    expect(saveStockCache(items)).toBe(true)

    const snap = loadStockCache()
    expect(snap.items).toEqual(items)
    expect(typeof snap.savedAt).toBe('string')
  })

  it('should return null for missing, corrupt, or empty snapshots', () => {
    expect(loadStockCache()).toBe(null)
    localStorage.setItem('jowen-stock-cache', 'not-json{{{')
    expect(loadStockCache()).toBe(null)
    expect(saveStockCache([])).toBe(false)
    expect(loadStockCache()).toBe(null)
    saveStockCache([{ id: 'i1' }])
    clearStockCache()
    expect(loadStockCache()).toBe(null)
  })
})

describe('replayInventoryUpdate', () => {
  const op = (overrides = {}) => ({
    method: 'inventory-update',
    table: 'inventory',
    matchField: 'id',
    matchValue: 'i1',
    body: { name: 'Milk', stock_quantity: 10 },
    base: { stock_quantity: 8 },
    reason: 'offline-edit',
    notes: null,
    ...overrides,
  })

  // Fresh chainable per from() call; update/insert payloads captured into
  // `seen` while selects resolve the canned live row.
  const stubSupabase = (seen, liveRow) => {
    supabase.from.mockImplementation((table) => {
      const builder = chainable(() => Promise.resolve({
        data: table === 'inventory' ? [liveRow] : [],
        error: null,
      }))
      const awaited = (resolve, reject) => {
        if (builder.update.mock.calls.length > 0) {
          seen.updates.push(builder.update.mock.calls[0][0])
          return Promise.resolve({ data: [], error: null }).then(resolve, reject)
        }
        if (builder.insert.mock.calls.length > 0) {
          seen.inserts.push({ table, body: builder.insert.mock.calls[0][0] })
          return Promise.resolve({ data: [], error: null }).then(resolve, reject)
        }
        return Promise.resolve({
          data: table === 'inventory' ? [liveRow] : [],
          error: null,
        }).then(resolve, reject)
      }
      builder.then = awaited
      return builder
    })
  }

  it('should apply direct fields and replay quantity as a delta with an adjustment', async () => {
    const { replayInventoryUpdate } = await import('../services/offlineQueue')
    const seen = { updates: [], inserts: [] }
    stubSupabase(seen, { id: 'i1', name: 'Milk', stock_quantity: 10 })

    await replayInventoryUpdate(op())

    expect(seen.updates).toContainEqual({ name: 'Milk' })
    // Live 10 + (queued 10 − base 8) = 12, clamped at 0, with ledger row.
    expect(seen.updates).toContainEqual({ stock_quantity: 12 })
    const adj = seen.inserts.find((i) => i.table === 'inventory_adjustments')
    expect(adj.body).toMatchObject({
      inventory_id: 'i1',
      previous_quantity: 10,
      new_quantity: 12,
      change_amount: 2,
      reason: 'offline-edit',
    })
  })

  it('should skip the adjustment when one was already queued (wastage)', async () => {
    const { replayInventoryUpdate } = await import('../services/offlineQueue')
    const seen = { updates: [], inserts: [] }
    stubSupabase(seen, { id: 'i1', name: 'Milk', stock_quantity: 10 })

    await replayInventoryUpdate(op({ skipAdjustment: true }))

    expect(seen.updates).toContainEqual({ stock_quantity: 12 })
    expect(seen.inserts.filter((i) => i.table === 'inventory_adjustments')).toHaveLength(0)
  })

  it('should clamp floored quantities at zero', async () => {
    const { replayInventoryUpdate } = await import('../services/offlineQueue')
    const seen = { updates: [], inserts: [] }
    stubSupabase(seen, { id: 'i1', name: 'Milk', stock_quantity: 1 })

    await replayInventoryUpdate(op({ body: { stock_quantity: 3 }, base: { stock_quantity: 8 } }))

    // Live 1 + (3 − 8) floored at 0.
    expect(seen.updates).toContainEqual({ stock_quantity: 0 })
  })

  it('should drop the op when the row was deleted meanwhile', async () => {
    const { replayInventoryUpdate } = await import('../services/offlineQueue')
    const seen = { updates: [], inserts: [] }
    stubSupabase(seen, undefined)

    await replayInventoryUpdate(op())

    expect(seen.updates).toHaveLength(0)
    expect(seen.inserts).toHaveLength(0)
  })
})

describe('offline fail-fast', () => {
  const setOnline = (value) => {
    Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
  }

  it('should reject immediately while offline instead of waiting out the 8s timeout', async () => {
    setOnline(false)
    try {
      const started = Date.now()
      await expect(db.getProducts()).rejects.toThrow(/offline/i)
      expect(Date.now() - started).toBeLessThan(2000)
    } finally {
      setOnline(true)
    }
  })
})

describe('parallel hourly fetches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch transactions and traffic concurrently, not sequentially', async () => {
    let releaseTxns
    const txnsGate = new Promise((res) => { releaseTxns = res })
    let txnsSettled = false
    let trafficStartedWhileTxnsPending = false
    supabase.from.mockImplementation((table) => {
      if (table === 'transactions') {
        return chainable(() => txnsGate.then(() => {
          txnsSettled = true
          return { data: [{ created_at: '2026-10-04T09:10:00' }], error: null }
        }))
      }
      return chainable(() => {
        if (!txnsSettled) trafficStartedWhileTxnsPending = true
        return Promise.resolve({
          data: [{ created_at: '2026-10-04T10:00:00', number_of_customer: 5 }],
          error: null,
        })
      })
    })

    const pending = db.getHourlyTrafficSplit('2026-10-04T00:00:00.000Z', '2026-10-04T23:59:59.999Z')
    // Let both fetches start while transactions are still gated.
    await new Promise((res) => setTimeout(res, 25))
    expect(trafficStartedWhileTxnsPending).toBe(true)
    releaseTxns()
    const hourly = await pending

    expect(hourly).toHaveLength(24)
    expect(hourly[9]).toMatchObject({ hour: 9, buyers: 1 })
    expect(hourly[10]).toMatchObject({ hour: 10, walkIns: 5 })
  })
})
