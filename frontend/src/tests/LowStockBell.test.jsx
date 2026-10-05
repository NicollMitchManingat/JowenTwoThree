import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LowStockBell from '../components/inventory/LowStockBell'
import { saveStockCache } from '../services/stockCache'

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
    localStorage.clear()
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

  it('should show split low/out badges and open the modal with sections', async () => {
    const user = userEvent.setup()
    db.getLowStockItems.mockResolvedValue([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 2, unit: 'L' },
    ])
    db.getOutOfStockItems.mockResolvedValue([
      { id: 'i2', name: 'Beans', category: 'Ingredients', stock_quantity: 0, unit: 'kg' },
    ])
    render(<LowStockBell />)

    await waitFor(() => {
      expect(screen.getByTestId('low-stock-bell-count')).toBeInTheDocument()
    })
    expect(screen.getByTestId('low-stock-bell-count')).toHaveAttribute('data-total', '2')
    expect(screen.getByTestId('low-stock-bell-low')).toHaveTextContent('1')
    expect(screen.getByTestId('low-stock-bell-low')).toHaveAttribute('title', '1 low stock')
    expect(screen.getByTestId('low-stock-bell-out')).toHaveTextContent('1')
    expect(screen.getByTestId('low-stock-bell-out')).toHaveAttribute('title', '1 out of stock')
    await user.click(screen.getByTestId('low-stock-bell'))

    expect(screen.getByTestId('stock-alerts-modal')).toBeInTheDocument()
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('Out of Stock (1)')
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('Low Stock (1)')
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('Beans')
    expect(screen.getByTestId('stock-alerts-modal')).toHaveTextContent('Milk')
  })

  it('should mark critical severity when anything is out of stock', async () => {
    db.getLowStockItems.mockResolvedValue([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 2, unit: 'L' },
    ])
    db.getOutOfStockItems.mockResolvedValue([
      { id: 'i2', name: 'Beans', category: 'Ingredients', stock_quantity: 0, unit: 'kg' },
    ])
    render(<LowStockBell />)

    await waitFor(() => {
      expect(screen.getByTestId('low-stock-bell')).toHaveAttribute('data-severity', 'critical')
    })
    expect(screen.getByTestId('low-stock-bell')).toHaveAccessibleName(/1 out of stock, 1 low/)
  })

  it('should mark warning severity when only low stock remains', async () => {
    db.getLowStockItems.mockResolvedValue([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 2, unit: 'L' },
    ])
    db.getOutOfStockItems.mockResolvedValue([])
    render(<LowStockBell />)

    await waitFor(() => {
      expect(screen.getByTestId('low-stock-bell')).toHaveAttribute('data-severity', 'warning')
    })
    expect(screen.queryByTestId('low-stock-bell-out')).not.toBeInTheDocument()
    expect(screen.getByTestId('low-stock-bell-low')).toHaveTextContent('1')
  })

  it('should render the small variant for compact neighbors', async () => {
    render(<LowStockBell size="small" />)

    await waitFor(() => {
      expect(db.getLowStockItems).toHaveBeenCalled()
    })
    expect(screen.getByTestId('low-stock-bell')).toHaveClass('stock-bell--small')
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

  it('should derive alert counts from the snapshot when fetches fail', async () => {
    saveStockCache([
      { id: 'i1', name: 'Milk', stock_quantity: 2 },
      { id: 'i2', name: 'Beans', stock_quantity: 0 },
    ])
    db.getLowStockItems.mockRejectedValueOnce(new Error('Request timed out after 8s.'))
    db.getOutOfStockItems.mockRejectedValueOnce(new Error('Request timed out after 8s.'))
    render(<LowStockBell />)

    await waitFor(() => {
      expect(screen.getByTestId('low-stock-bell-count')).toBeInTheDocument()
    })
    expect(screen.getByTestId('low-stock-bell-count')).toHaveAttribute('data-total', '2')
    expect(screen.getByTestId('low-stock-bell-low')).toHaveTextContent('1')
    expect(screen.getByTestId('low-stock-bell-out')).toHaveTextContent('1')
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

  it('should play the enter animation on open', async () => {
    const user = userEvent.setup()
    render(<LowStockBell />)

    await waitFor(() => {
      expect(db.getLowStockItems).toHaveBeenCalled()
    })
    await user.click(screen.getByTestId('low-stock-bell'))

    const modal = screen.getByTestId('stock-alerts-modal')
    expect(modal).toHaveAttribute('data-closing', 'false')
    expect(modal).toHaveClass('stock-alerts-enter')
  })

  it('should play the exit animation before unmounting on close', async () => {
    const user = userEvent.setup()
    render(<LowStockBell />)

    await waitFor(() => {
      expect(db.getLowStockItems).toHaveBeenCalled()
    })
    await user.click(screen.getByTestId('low-stock-bell'))
    expect(screen.getByTestId('stock-alerts-modal')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Close stock alerts'))

    // Still mounted mid-exit with the exit class applied.
    const closing = screen.getByTestId('stock-alerts-modal')
    expect(closing).toHaveAttribute('data-closing', 'true')
    expect(closing).toHaveClass('stock-alerts-exit')

    // Unmounts once the fade ends.
    await waitFor(() => {
      expect(screen.queryByTestId('stock-alerts-modal')).not.toBeInTheDocument()
    })
  })
})
