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
  for (const m of ['select', 'gte', 'lte', 'order', 'range', 'in', 'eq', 'limit', 'abortSignal']) {
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
