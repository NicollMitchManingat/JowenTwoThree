import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import InventoryPage from '../pages/InventoryPage'

vi.mock('../services/db', () => ({
  db: {
    getInventory: vi.fn().mockResolvedValue([
      { id: 'i1', name: 'Milk', category: 'Dairy', stock_quantity: 8 },
    ]),
    getLowStockItems: vi.fn().mockResolvedValue([]),
    getOutOfStockItems: vi.fn().mockResolvedValue([]),
  },
}))

describe('InventoryPage roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should give admins add, edit, wastage, and delete controls', async () => {
    render(<InventoryPage userRole="admin" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.getByText('Add Item')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByTitle('Log Wastage')).toBeInTheDocument()
    expect(screen.getByTitle('Edit item')).toBeInTheDocument()
    expect(screen.getByTitle('Delete item')).toBeInTheDocument()
  })

  it('should give stockists add, edit, and wastage controls but no delete', async () => {
    render(<InventoryPage userRole="stockist" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.getByText('Add Item')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByTitle('Log Wastage')).toBeInTheDocument()
    expect(screen.getByTitle('Edit item')).toBeInTheDocument()
    expect(screen.queryByTitle('Delete item')).not.toBeInTheDocument()
  })

  it('should give cashiers a read-only inventory view', async () => {
    render(<InventoryPage userRole="cashier" />)

    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
    })
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument()
    expect(screen.queryByText('Actions')).not.toBeInTheDocument()
  })
})
