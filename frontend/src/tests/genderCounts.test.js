import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../services/db'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../services/offlineQueue', () => ({
  offlineQueue: { enqueue: vi.fn(), size: vi.fn().mockResolvedValue(0) },
  processQueue: vi.fn().mockResolvedValue(),
}))

// Captures the row createTransaction / logTraffic hand to PostgREST.
let captured = null
function stubInsert() {
  captured = null
  supabase.from.mockReturnValue({
    insert: (body) => {
      captured = body
      return {
        select: () => Promise.resolve({ data: [{ id: 'row-1' }], error: null }),
      }
    },
  })
}

describe('gender count writes (peso total must never become headcount)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    stubInsert()
  })

  it('should store headcount, not peso total, on a MainPOS-shaped payload', async () => {
    // Exact shape MainPOS sends online: peso `total` sits next to the split.
    // Regression: `total: 432` once leaked into customer_count (432 heads).
    await db.createTransaction({
      transaction_number: 'TXN-REG',
      idempotency_key: 'key-1',
      subtotal: 432,
      discount: 0,
      total: 432,
      payment_method: 'CASH',
      cash_received: 432,
      change_amount: 0,
      customer_count: 2,
      male: 1,
      female: 1,
      unspecified: 0,
      special_instructions: '',
      cart: [],
    })

    expect(captured).toMatchObject({
      customer_count: 2,
      male_count: 1,
      female_count: 1,
      unspecified_count: 0,
    })
    expect(captured.customer_count).not.toBe(432)
  })

  it('should rebalance a legacy total into unspecified without touching pesos', async () => {
    await db.createTransaction({
      transaction_number: 'TXN-LEGACY',
      idempotency_key: 'key-2',
      subtotal: 160,
      discount: 0,
      total: 160,
      payment_method: 'CASH',
      cash_received: 160,
      change_amount: 0,
      customer_count: 1,
      cart: [],
    })

    expect(captured).toMatchObject({
      customer_count: 1,
      male_count: 0,
      female_count: 0,
      unspecified_count: 1,
    })
  })

  it('should derive traffic totals from the split, ignoring any total key', async () => {
    await db.logTraffic({ male: 1, female: 2, unspecified: 0, total: 999 })

    expect(captured).toMatchObject({
      number_of_customer: 3,
      male_count: 1,
      female_count: 2,
      unspecified_count: 0,
    })
  })
})
