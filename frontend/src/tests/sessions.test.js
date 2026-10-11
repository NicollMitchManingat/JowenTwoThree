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

// Minimal PostgREST stub: every filter returns the builder; awaiting it
// resolves the canned { data, error }. insert() captures its body.
function tableStub(rows, onInsert) {
  const builder = {}
  for (const m of ['select', 'insert', 'update', 'eq', 'is', 'order', 'limit', 'single', 'abortSignal']) {
    builder[m] = vi.fn(() => builder)
  }
  builder.then = (resolve, reject) => Promise.resolve().then(() => rows()).then(resolve, reject)
  if (onInsert) {
    builder.insert = vi.fn((body) => {
      onInsert(body)
      return builder
    })
  }
  return builder
}

describe('db sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('should return the open session or null', async () => {
    const open = { id: 's1', started_at: new Date().toISOString(), started_by: 'admin' }
    supabase.from.mockReturnValueOnce(tableStub(() => ({ data: [open], error: null })))
    await expect(db.getActiveSession()).resolves.toEqual(open)

    supabase.from.mockReturnValueOnce(tableStub(() => ({ data: [], error: null })))
    await expect(db.getActiveSession()).resolves.toBeNull()
  })

  it('should close stragglers then open a session attributed to the starter', async () => {
    let captured = null
    // Straggler-close update.
    supabase.from.mockReturnValueOnce(tableStub(() => ({ data: [], error: null })))
    // Insert returning the new row.
    const opened = { id: 's9', started_at: new Date().toISOString(), ended_at: null, started_by: 'admin' }
    supabase.from.mockReturnValueOnce(tableStub(() => ({ data: [opened], error: null }), (body) => { captured = body }))
    // offlineWrite does insert().select() — the stub select resolves the row.
    const result = await db.startSession({ by: 'admin' })

    expect(supabase.from).toHaveBeenCalledWith('sessions')
    expect(captured).toMatchObject({ started_by: 'admin', ended_at: null })
    expect(result).toMatchObject({ id: 's9' })
  })

  it('should stamp ended_at and ended_by on close', async () => {
    let captured = null
    const closed = { id: 's1', ended_at: new Date().toISOString(), ended_by: 'admin' }
    const builder = tableStub(() => ({ data: closed, error: null }))
    builder.update = vi.fn((body) => {
      captured = body
      return builder
    })
    supabase.from.mockReturnValueOnce(builder)

    await db.endSession('s1', { by: 'admin' })
    expect(captured).toMatchObject({ ended_by: 'admin' })
    expect(captured.ended_at).toEqual(expect.any(String))
  })

  it('should list past sessions newest first', async () => {
    const rows = [
      { id: 's2', started_at: '2026-10-10T10:00:00Z', ended_at: '2026-10-10T12:00:00Z' },
      { id: 's1', started_at: '2026-10-09T10:00:00Z', ended_at: '2026-10-09T12:00:00Z' },
    ]
    supabase.from.mockReturnValueOnce(tableStub(() => ({ data: rows, error: null })))
    await expect(db.getSessions()).resolves.toEqual(rows)
  })

  it('should treat a missing sessions table as no data, not a crash', async () => {
    const missing = { message: "Could not find the table 'public.sessions' in the schema cache", code: 'PGRST205' }
    supabase.from.mockReturnValueOnce(tableStub(() => Promise.reject(missing)))
    await expect(db.getActiveSession()).resolves.toBeNull()

    supabase.from.mockReturnValueOnce(tableStub(() => Promise.reject(missing)))
    await expect(db.getSessions()).resolves.toEqual([])
  })
})
