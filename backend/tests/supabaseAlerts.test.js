import { describe, test, expect, vi } from 'vitest'

const alertsStore = require('../src/services/alertsSupabaseStore')
const { __setSupabaseClient, getAllAlerts, getAlertById } = alertsStore

describe('Supabase Alerts Store', () => {
  test('returns alerts from the alerts table', async () => {
    const mockData = [
      { id: 'alert-1', severity: 'high', message: 'Low stock' },
      { id: 'alert-2', severity: 'medium', message: 'Near expiration' },
    ]

    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    })

    __setSupabaseClient(() => ({ from: fromMock }))

    const data = await getAllAlerts()

    expect(fromMock).toHaveBeenCalledWith('alerts')
    expect(data).toEqual(mockData)
  })

  test('returns a specific alert by id using eq + single', async () => {
    const mockRow = { id: 'alert-1', severity: 'high', message: 'Low stock' }

    const singleChain = vi.fn().mockResolvedValue({ data: mockRow, error: null })

    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: singleChain }),
      }),
    })

    __setSupabaseClient(() => ({ from: fromMock }))

    const data = await getAlertById('alert-1')

    expect(fromMock).toHaveBeenCalledWith('alerts')
    expect(data).toEqual(mockRow)
  })
})

