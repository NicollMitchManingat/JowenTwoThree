import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from '../pages/SettingsPage'
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
})
