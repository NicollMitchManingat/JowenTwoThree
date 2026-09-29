import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'

vi.mock('../services/db', () => ({
  db: {
    getProducts: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    getActiveDiscounts: vi.fn().mockResolvedValue([]),
    getLowStockItems: vi.fn().mockResolvedValue([]),
    getOutOfStockItems: vi.fn().mockResolvedValue([]),
    getTransactions: vi.fn().mockResolvedValue([]),
    getRefundsForTransactions: vi.fn().mockResolvedValue([]),
    getInventory: vi.fn().mockResolvedValue([]),
  },
}))

function renderAs(user) {
  localStorage.setItem('jowen_user', JSON.stringify(user))
  render(<App />)
}

describe('App role navigation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // Nav labels repeat as page headers — scope assertions to the sidebar nav.
  const nav = () => within(screen.getByRole('navigation'))

  it('should hide Inventory from cashiers but keep POS and Transactions', () => {
    renderAs({ username: 'cashier', role: 'cashier' })

    expect(nav().getByText('POS & Traffic')).toBeInTheDocument()
    expect(nav().getByText('Transactions')).toBeInTheDocument()
    expect(nav().queryByText('Inventory')).not.toBeInTheDocument()
    expect(nav().queryByText('Analytics')).not.toBeInTheDocument()
  })

  it('should hide POS and Analytics from stockists but keep Inventory', () => {
    renderAs({ username: 'stockist', role: 'stockist' })

    expect(nav().getByText('Inventory')).toBeInTheDocument()
    expect(nav().getByText('Transactions')).toBeInTheDocument()
    expect(nav().queryByText('POS & Traffic')).not.toBeInTheDocument()
    expect(nav().queryByText('Analytics')).not.toBeInTheDocument()
  })

  it('should show everything to admins', () => {
    renderAs({ username: 'admin', role: 'admin' })

    expect(nav().getByText('POS & Traffic')).toBeInTheDocument()
    expect(nav().getByText('Inventory')).toBeInTheDocument()
    expect(nav().getByText('Transactions')).toBeInTheDocument()
    expect(nav().getByText('Analytics')).toBeInTheDocument()
  })

  it('should land stockists on Inventory, not POS', async () => {
    renderAs({ username: 'stockist', role: 'stockist' })

    // No POS traffic widget for stockists; inventory search is shown instead.
    expect(screen.queryByTestId('traffic-widget')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search inventory...')).toBeInTheDocument()
    })
  })
})
