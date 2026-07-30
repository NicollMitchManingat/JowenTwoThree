import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '../App'

vi.mock('../services/db', () => ({
  db: {
    getProducts: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    getTransactions: vi.fn().mockResolvedValue([]),
    getInventory: vi.fn().mockResolvedValue([
      { id: '1', name: 'Arabica Beans', category: 'Ingredients', stock_quantity: 12 },
      { id: '2', name: 'Whole Milk', category: 'Dairy', stock_quantity: 4 },
    ]),
    getTodayStats: vi.fn().mockResolvedValue({ totalOrders: 0, totalSales: 0, totalCustomers: 0 }),
    getInventoryStatus: vi.fn().mockResolvedValue([]),
    createTransaction: vi.fn(),
    createTransactionItems: vi.fn(),
    logTraffic: vi.fn(),
    createInventoryItem: vi.fn(),
    updateInventoryItem: vi.fn(),
    deleteInventoryItem: vi.fn(),
  }
}))

describe('Inventory Dashboard', () => {
  it('renders sidebar with navigation links after login', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByTestId('username-input'), 'admin')
    await user.type(screen.getByTestId('password-input'), 'admin123')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(screen.getAllByText('POS & Traffic').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Inventory')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  it('renders inventory table with correct headers', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByTestId('username-input'), 'admin')
    await user.type(screen.getByTestId('password-input'), 'admin123')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(screen.getByText('Menu')).toBeInTheDocument()
    })

    const inventoryNavItem = screen.getByText('Inventory')
    await user.click(inventoryNavItem)

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Stock')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })
  })

  it('page layout has sidebar after login', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByTestId('username-input'), 'admin')
    await user.type(screen.getByTestId('password-input'), 'admin123')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(screen.getByText("Jowen's Cafe")).toBeInTheDocument()
    })
  })
})
