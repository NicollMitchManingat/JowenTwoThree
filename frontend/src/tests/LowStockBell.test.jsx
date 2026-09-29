import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LowStockBell from '../components/inventory/LowStockBell'

vi.mock('../services/db', () => ({
  db: {
    getLowStockItems: vi.fn().mockResolvedValue([]),
    getOutOfStockItems: vi.fn().mockResolvedValue([]),
  },
}))

import { db } from '../services/db'

describe('LowStockBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.getLowStockItems.mockResolvedValue([])
    db.getOutOfStockItems.mockResolvedValue([])
  })

  it('should render the bell and fetch alerts on mount', async () => {
    render(<LowStockBell />)

    expect(screen.getByTestId('low-stock-bell')).toBeInTheDocument()
    await waitFor(() => {
      expect(db.getLowStockItems).toHaveBeenCalledWith(5)
    })
    expect(db.getOutOfStockItems).toHaveBeenCalled()
  })

  it('should show the alert count badge and open the modal with sections', async () => {
    const user = userEvent.setup()
    db.getLowStockItems.mockResolvedValue([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 2, unit: 'L' },
    ])
    db.getOutOfStockItems.mockResolvedValue([
      { id: 'i2', name: 'Beans', category: 'Ingredients', stock_quantity: 0, unit: 'kg' },
    ])
    render(<LowStockBell />)

    await waitFor(() => {
      expect(screen.getByTestId('low-stock-bell-count')).toHaveTextContent('2')
    })
    await user.click(screen.getByTestId('low-stock-bell'))

    expect(screen.getByTestId('stock-alerts-modal')).toBeInTheDocument()
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('Out of Stock (1)')
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('Low Stock (1)')
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('Beans')
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('Milk')
  })

  it('should show the empty state when fully stocked', async () => {
    const user = userEvent.setup()
    render(<LowStockBell />)

    await waitFor(() => {
      expect(db.getLowStockItems).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('low-stock-bell-count')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('low-stock-bell'))
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('All Stocked Up!')
  })

  it('should tolerate fetch failures without crashing', async () => {
    db.getLowStockItems.mockRejectedValueOnce(new Error('Supabase waking up'))
    db.getOutOfStockItems.mockRejectedValueOnce(new Error('Supabase waking up'))
    render(<LowStockBell />)

    await waitFor(() => {
      expect(db.getLowStockItems).toHaveBeenCalled()
    })
    expect(screen.getByTestId('low-stock-bell')).toBeInTheDocument()
  })
})
