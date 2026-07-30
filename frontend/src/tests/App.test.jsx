import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

vi.mock('../services/db', () => ({
  db: {
    getProducts: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    getTransactions: vi.fn().mockResolvedValue([]),
    getInventory: vi.fn().mockResolvedValue([]),
    getTodayStats: vi.fn().mockResolvedValue({ totalOrders: 0, totalSales: 0, totalCustomers: 0 }),
    getInventoryStatus: vi.fn().mockResolvedValue([]),
    createTransaction: vi.fn(),
    createTransactionItems: vi.fn(),
    logTraffic: vi.fn(),
  }
}))

describe('App Integration', () => {
  it('should render login page initially', () => {
    render(<App />)

    expect(screen.getByText("Jowen's Kitchen & Cafe")).toBeInTheDocument()
    expect(screen.getByTestId('login-button')).toBeInTheDocument()
  })

  it('should navigate to main POS after login with admin credentials', async () => {
    const user = userEvent.setup()
    render(<App />)

    const usernameInput = screen.getByTestId('username-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'admin')
    await user.type(passwordInput, 'admin123')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getAllByText('POS & Traffic').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should display user profile in top header after login', async () => {
    const user = userEvent.setup()
    render(<App />)

    const usernameInput = screen.getByTestId('username-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'admin')
    await user.type(passwordInput, 'admin123')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument()
    })
  })

  it('should show POS content after login', async () => {
    const user = userEvent.setup()
    render(<App />)

    const usernameInput = screen.getByTestId('username-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'admin')
    await user.type(passwordInput, 'admin123')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByText('Menu')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search menu...')).toBeInTheDocument()
    })
  })

  it('should return to login page after logout', async () => {
    const user = userEvent.setup()
    render(<App />)

    const usernameInput = screen.getByTestId('username-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'admin')
    await user.type(passwordInput, 'admin123')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search menu...')).toBeInTheDocument()
    })

    const logoutButton = screen.getByTitle('Logout')
    await user.click(logoutButton)

    await waitFor(() => {
      expect(screen.getByText("Jowen's Kitchen & Cafe")).toBeInTheDocument()
      expect(screen.getByTestId('login-button')).toBeInTheDocument()
    })
  })
})
