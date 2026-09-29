import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountManager from '../components/settings/AccountManager'

vi.mock('../services/authAPI', () => ({
  authAPI: {
    listUsers: vi.fn(),
    createUser: vi.fn().mockResolvedValue({ id: 'new-1' }),
    updateUser: vi.fn().mockResolvedValue({}),
  },
}))

import { authAPI } from '../services/authAPI'

const ACCOUNTS = [
  { id: 'a1', username: 'admin', fullName: 'Admin User', email: 'admin@jowen.com', role: 'admin', isActive: true },
  { id: 'c1', username: 'cashier', fullName: 'Cashier', email: 'cashier@jowen.com', role: 'cashier', isActive: true },
  { id: 's1', username: 'stockist', fullName: 'Stockist', email: 'stockist@jowen.com', role: 'stockist', isActive: false },
]

const ADMIN_USER = { username: 'admin', role: 'admin' }

async function unlock(user) {
  await user.type(screen.getByTestId('account-unlock-password'), 'admin123')
  await user.click(screen.getByTestId('account-unlock-btn'))
}

describe('AccountManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authAPI.listUsers.mockResolvedValue(ACCOUNTS)
  })

  it('should require the admin password before listing accounts', async () => {
    const user = userEvent.setup()
    render(<AccountManager currentUser={ADMIN_USER} />)

    expect(screen.getByTestId('account-unlock-password')).toBeInTheDocument()
    expect(authAPI.listUsers).not.toHaveBeenCalled()

    await unlock(user)

    await waitFor(() => {
      expect(authAPI.listUsers).toHaveBeenCalledWith('admin', 'admin123')
    })
    expect(screen.getByTestId('account-row-a1')).toBeInTheDocument()
  })

  it('should surface unlock failures without listing', async () => {
    const user = userEvent.setup()
    authAPI.listUsers.mockRejectedValueOnce(new Error('Manager approval failed: incorrect admin password'))
    render(<AccountManager currentUser={ADMIN_USER} />)

    await unlock(user)

    await waitFor(() => {
      expect(screen.getByTestId('account-error')).toHaveTextContent(/incorrect admin password/)
    })
    expect(screen.queryByTestId('account-row-a1')).not.toBeInTheDocument()
  })

  it('should list roles and statuses, marking the current admin', async () => {
    const user = userEvent.setup()
    render(<AccountManager currentUser={ADMIN_USER} />)
    await unlock(user)

    await waitFor(() => {
      expect(screen.getByTestId('account-row-s1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('account-row-a1')).toHaveTextContent('You')
    expect(screen.getByTestId('account-row-s1')).toHaveTextContent('Inactive')
    // No deactivate toggle for your own row
    expect(screen.queryByTestId('account-toggle-a1')).not.toBeInTheDocument()
    expect(screen.getByTestId('account-toggle-s1')).toHaveTextContent('Activate')
  })

  it('should create a new cashier account from the form', async () => {
    const user = userEvent.setup()
    render(<AccountManager currentUser={ADMIN_USER} />)
    await unlock(user)

    await waitFor(() => {
      expect(screen.getByTestId('account-add-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('account-add-btn'))
    await user.type(screen.getByTestId('account-username-input'), 'cashier2')
    await user.type(screen.getByTestId('account-name-input'), 'Cashier Two')
    await user.type(screen.getByTestId('account-email-input'), 'cashier2@jowen.com')
    await user.selectOptions(screen.getByTestId('account-role-select'), 'cashier')
    await user.type(screen.getByTestId('account-password-input'), 'cafe123')
    await user.click(screen.getByTestId('account-save-btn'))

    await waitFor(() => {
      expect(authAPI.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'cashier2',
          email: 'cashier2@jowen.com',
          role: 'cashier',
          password: 'cafe123',
        }),
        'admin',
        'admin123'
      )
    })
  })

  it('should deactivate another account via the toggle', async () => {
    const user = userEvent.setup()
    render(<AccountManager currentUser={ADMIN_USER} />)
    await unlock(user)

    await waitFor(() => {
      expect(screen.getByTestId('account-toggle-c1')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('account-toggle-c1'))

    await waitFor(() => {
      expect(authAPI.updateUser).toHaveBeenCalledWith('c1', { isActive: false }, 'admin', 'admin123')
    })
  })
})
