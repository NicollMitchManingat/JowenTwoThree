import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage, { formatElapsed, computeSessionSummary } from '../pages/SettingsPage'
import { db } from '../services/db'

vi.mock('../services/db', () => ({
  db: {
    getActiveSession: vi.fn(),
    startSession: vi.fn(),
    endSession: vi.fn(),
    getSessions: vi.fn(),
    getTransactionsForAnalytics: vi.fn(),
    getRefundsForTransactions: vi.fn(),
  },
}))

vi.mock('../components/settings/AccountManager', () => ({
  default: () => <div data-testid="account-mock" />,
}))
vi.mock('../components/settings/DiscountManager', () => ({
  default: () => <div data-testid="discount-mock" />,
}))
vi.mock('../components/settings/RecipeManager', () => ({
  default: () => <div data-testid="recipe-mock" />,
}))

const ADMIN = { username: 'admin', role: 'admin' }
const noop = () => {}

describe('session helpers', () => {
  it('should format elapsed milliseconds as HH:MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00:00')
    expect(formatElapsed(3723000)).toBe('01:02:03')
    expect(formatElapsed(90061000)).toBe('25:01:01')
  })

  it('should close out a window like the Transactions tab does', () => {
    const txns = [
      { id: 'a', total: 300, discount: 0, status: 'COMPLETED', male_count: 1, female_count: 2, unspecified_count: 0 },
      { id: 'b', total: 200, discount: 0, status: 'REFUNDED', male_count: 1, female_count: 0, unspecified_count: 0 },
      { id: 'c', total: 360, discount: 40, status: 'PARTIALLY_REFUNDED', male_count: 0, female_count: 1, unspecified_count: 0 },
    ]
    const summary = computeSessionSummary(txns, {
      c: [{ refund_amount: 180 }],
    })
    // Fully refunded order leaves gross entirely; its refund isn't subtracted.
    expect(summary.orders).toBe(3)
    expect(summary.gross).toBe(660)
    expect(summary.discounts).toBe(40)
    expect(summary.refunded).toBe(180)
    expect(summary.refundCount).toBe(1)
    expect(summary.net).toBe(480)
    expect(summary.customers).toEqual({ total: 5, male: 2, female: 3, unspecified: 0 })
    expect(summary.avgOrder).toBe(220)
  })
})

describe('SettingsPage sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    db.getActiveSession.mockResolvedValue(null)
    db.getSessions.mockResolvedValue([])
    db.getTransactionsForAnalytics.mockResolvedValue([])
    db.getRefundsForTransactions.mockResolvedValue([])
  })

  it('should resume the timer from an already-open session', async () => {
    const startedAt = new Date(Date.now() - 3723000).toISOString()
    db.getActiveSession.mockResolvedValueOnce({ id: 's1', started_at: startedAt, started_by: 'admin' })
    render(<SettingsPage currentUser={ADMIN} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-timer')).toBeInTheDocument()
    })
    expect(screen.getByTestId('session-timer')).toHaveTextContent(/01:02/)
    expect(screen.getByTestId('session-timer')).toHaveTextContent(/by admin/)
    expect(screen.getByTestId('session-end-btn')).toBeInTheDocument()
  })

  it('should start a session attributed to the current user', async () => {
    const user = userEvent.setup()
    db.startSession.mockResolvedValueOnce({ id: 's9', started_at: new Date().toISOString(), started_by: 'admin' })
    render(<SettingsPage currentUser={ADMIN} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-start-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('session-start-btn'))

    await waitFor(() => {
      expect(db.startSession).toHaveBeenCalledWith({ by: 'admin' })
    })
    expect(screen.getByTestId('session-timer')).toBeInTheDocument()
  })

  it('should close out with net cash on end', async () => {
    const user = userEvent.setup()
    db.getActiveSession.mockResolvedValueOnce({ id: 's1', started_at: new Date().toISOString(), started_by: 'admin' })
    db.getTransactionsForAnalytics.mockResolvedValueOnce([
      { id: 'a', total: 300, discount: 0, status: 'COMPLETED', male_count: 1, female_count: 2, unspecified_count: 0 },
    ])
    db.endSession.mockResolvedValueOnce({ id: 's1', started_at: new Date().toISOString(), ended_at: new Date().toISOString() })
    render(<SettingsPage currentUser={ADMIN} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-end-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('session-end-btn'))

    await waitFor(() => {
      expect(db.endSession).toHaveBeenCalledWith('s1', { by: 'admin' })
    })
    expect(screen.getByTestId('session-handover')).toBeInTheDocument()
    expect(screen.getByTestId('handover-net-cash')).toHaveTextContent('₱300.00')
    expect(screen.getByTestId('handover-orders')).toHaveTextContent('1 orders')
  })

  it('should list past sessions with on-demand details', async () => {
    const user = userEvent.setup()
    const s1start = new Date(Date.now() - 7200000).toISOString()
    const s1end = new Date(Date.now() - 3600000).toISOString()
    db.getSessions.mockResolvedValueOnce([
      { id: 's1', started_at: s1start, ended_at: s1end, started_by: 'admin' },
      { id: 's2', started_at: new Date(Date.now() - 90000000).toISOString(), ended_at: new Date(Date.now() - 86400000).toISOString(), started_by: 'cashier' },
    ])
    db.getTransactionsForAnalytics.mockResolvedValueOnce([
      { id: 'a', total: 100, discount: 0, status: 'COMPLETED', male_count: 1, female_count: 0, unspecified_count: 0 },
    ])
    render(<SettingsPage currentUser={ADMIN} onLogout={noop} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-row-s1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('session-row-s2')).toBeInTheDocument()
    expect(screen.getByTestId('session-pager-count')).toHaveTextContent('Showing 1–2 of 2')

    await user.click(screen.getByTestId('session-view-s1'))
    await waitFor(() => {
      expect(db.getTransactionsForAnalytics).toHaveBeenCalledWith(s1start, s1end)
    })
    expect(screen.getByTestId('session-handover')).toBeInTheDocument()
    expect(screen.getByTestId('handover-net-cash')).toHaveTextContent('₱100.00')
  })
})
