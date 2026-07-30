import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MainPOS from '../pages/MainPOS'

vi.mock('../services/db', () => ({
  db: {
    getProducts: vi.fn().mockResolvedValue([
      { id: '1', product_name: 'Espresso', selling_price: 150, product_categories: { name: 'Drinks' } },
      { id: '2', product_name: 'Latte', selling_price: 180, product_categories: { name: 'Drinks' } },
    ]),
    getCategories: vi.fn().mockResolvedValue([
      { id: '1', name: 'Drinks' },
    ]),
    createTransaction: vi.fn(),
    createTransactionItems: vi.fn(),
    logTraffic: vi.fn(),
  }
}))

describe('MainPOS', () => {
  const mockUser = {
    username: 'testuser',
    role: 'staff'
  }

  it('should render main POS layout', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search menu...')).toBeInTheDocument()
    })
    expect(screen.getByText('Espresso')).toBeInTheDocument()
  })

  it('should display customer traffic controls', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Traffic:')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('0')).toBeInTheDocument()
  })

  it('should add item to order when product is clicked', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))

    expect(screen.getByText('Add Espresso')).toBeInTheDocument()
  })

  it('should display current order section', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Current Order')).toBeInTheDocument()
    })
  })

  it('should display total in order summary', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument()
    })
  })
})
