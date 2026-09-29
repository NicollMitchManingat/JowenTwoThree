import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MainPOS from '../pages/MainPOS'
import { db } from '../services/db'

vi.mock('../services/db', () => ({
  db: {
    getProducts: vi.fn().mockResolvedValue([
      { id: '1', product_name: 'Espresso', selling_price: 150, product_categories: { name: 'Drinks' } },
      { id: '2', product_name: 'Latte', selling_price: 180, product_categories: { name: 'Drinks' } },
    ]),
    getCategories: vi.fn().mockResolvedValue([
      { id: '1', name: 'Drinks' },
    ]),
    computeRequiredDeductions: vi.fn().mockResolvedValue([]),
    applyDeductions: vi.fn().mockResolvedValue({ shorted: [] }),
    createTransaction: vi.fn().mockResolvedValue({ id: 'txn-1', transaction_number: 'TXN-1' }),
    createTransactionItems: vi.fn().mockResolvedValue([]),
    logTraffic: vi.fn(),
  }
}))

describe('MainPOS', () => {
  const mockUser = {
    username: 'testuser',
    role: 'staff'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render main POS layout', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search menu...')).toBeInTheDocument()
    })
    expect(screen.getByText('Espresso')).toBeInTheDocument()
  })

  it('should display gender-split customer traffic controls', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Traffic:')).toBeInTheDocument()
    })
    expect(screen.getByTestId('male-count-input')).toHaveValue(0)
    expect(screen.getByTestId('female-count-input')).toHaveValue(0)
    expect(screen.getByTestId('unspecified-count-input')).toHaveValue(0)
    expect(screen.getByTestId('traffic-total')).toHaveTextContent('Total: 0')
  })

  it('should sum male + female + unspecified into the traffic total', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByTestId('male-count-input')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Increase male count'))
    await user.click(screen.getByLabelText('Increase male count'))
    await user.click(screen.getByLabelText('Increase female count'))

    expect(screen.getByTestId('traffic-total')).toHaveTextContent('Total: 3')
  })

  it('should checkout with the gender split and log gendered traffic', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByLabelText('Increase male count'))
    await user.click(screen.getByLabelText('Increase female count'))
    await user.click(screen.getByLabelText('Increase female count'))
    await user.click(screen.getByText('Espresso'))
    await user.click(screen.getByText('Checkout & Log Traffic'))

    await waitFor(() => {
      expect(db.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ customer_count: 3, male: 1, female: 2, unspecified: 0 })
      )
    })
    expect(db.logTraffic).toHaveBeenCalledWith({ male: 1, female: 2, unspecified: 0 })
    expect(screen.getByTestId('receipt-customer-breakdown')).toHaveTextContent('3')
    expect(screen.getByTestId('receipt-customer-breakdown')).toHaveTextContent('M1/F2')
  })

  it('should default quick-add traffic to unspecified when no gender tapped', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))

    expect(screen.getByTestId('unspecified-count-input')).toHaveValue(1)
    expect(screen.getByTestId('traffic-total')).toHaveTextContent('Total: 1')
  })

  it('should quick-add item to order without a modal when product is clicked', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))

    // No modal prompt — line lands straight in the cart
    expect(screen.queryByText('Add Espresso')).not.toBeInTheDocument()
    expect(screen.getByText('1 Items')).toBeInTheDocument()
  })

  it('should merge repeat taps of the same product into one line', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    // Menu card is always the first match (cart lines render after the menu)
    await user.click(screen.getAllByText('Espresso')[0])
    await user.click(screen.getAllByText('Espresso')[0])

    expect(screen.getByText('2 Items')).toBeInTheDocument()
    // Menu card + exactly one cart line
    expect(screen.getAllByText('Espresso')).toHaveLength(2)
  })

  it('should add special instructions via the cart note button', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))
    await user.click(screen.getByTitle('Add special instructions'))

    expect(screen.getByText('Notes for Espresso')).toBeInTheDocument()
    await user.type(screen.getByTestId('note-textarea'), 'Less sugar')
    await user.click(screen.getByTestId('save-note-btn'))

    expect(screen.getByText('"Less sugar"')).toBeInTheDocument()
    expect(screen.getByTitle('Edit special instructions')).toBeInTheDocument()
  })

  it('should show per-item notes on the receipt and persist them', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByText('Espresso')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Espresso'))
    await user.click(screen.getByTitle('Add special instructions'))
    await user.type(screen.getByTestId('note-textarea'), 'Extra hot')
    await user.click(screen.getByTestId('save-note-btn'))

    await user.click(screen.getByText('Checkout & Log Traffic'))

    await waitFor(() => {
      expect(screen.getByTestId('receipt')).toBeInTheDocument()
    })
    expect(screen.getByText('1 x ₱150.00 — Extra hot')).toBeInTheDocument()
    expect(db.createTransactionItems).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ note: 'Extra hot' })])
    )
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

  it('should hide the radial FAB for non-admin staff', async () => {
    render(<MainPOS user={mockUser} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search menu...')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('radial-fab')).not.toBeInTheDocument()
  })

  it('should open the radial menu and launch the add-product modal for admins', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={{ username: 'admin', role: 'admin' }} />)

    await waitFor(() => {
      expect(screen.getByTestId('radial-fab-main')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('radial-fab-main'))
    expect(screen.getByTestId('radial-fab-add')).toBeInTheDocument()
    expect(screen.getByTestId('radial-fab-delete')).toBeInTheDocument()

    await user.click(screen.getByTestId('radial-fab-add'))
    expect(screen.getByText('Add New Product')).toBeInTheDocument()
  })
})
