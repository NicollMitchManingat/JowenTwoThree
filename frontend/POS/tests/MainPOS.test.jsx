import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MainPOS from '../src/pages/MainPOS'

vi.mock('../src/services/productAPI', () => ({
  productAPI: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Burger',
        price: 120,
        category: 'Food'
      },
      {
        id: 2,
        name: 'Fries',
        price: 60,
        category: 'Food'
      },
      {
        id: 3,
        name: 'Coffee',
        price: 80,
        category: 'Beverages'
      }
    ])
  }
}))

describe('MainPOS', () => {
  const mockUser = {
    username: 'testuser',
    email: 'test@example.com'
  }

  const mockOnLogout = vi.fn()

  it('should render main POS layout', async () => {
    render(
      <MainPOS
        user={mockUser}
        onLogout={mockOnLogout}
      />
    )

    expect(screen.getByText('Point-of-Sale')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('product-page')).toBeInTheDocument()
    expect(screen.getByTestId('order-summary')).toBeInTheDocument()
  })

  it('should display customer recording button', () => {
    render(
      <MainPOS
        user={mockUser}
        onLogout={mockOnLogout}
      />
    )

    expect(screen.getByTestId('customer-recording-button')).toBeInTheDocument()
  })

  it('should navigate between menu items', async () => {
    const user = userEvent.setup()

    render(
      <MainPOS
        user={mockUser}
        onLogout={mockOnLogout}
      />
    )

    await user.click(screen.getByTestId('menu-inventory'))

    expect(screen.getByText('Inventory Module')).toBeInTheDocument()
  })

  it('should display POS content when POS menu is selected', async () => {
    const user = userEvent.setup()

    render(
      <MainPOS
        user={mockUser}
        onLogout={mockOnLogout}
      />
    )

    await user.click(screen.getByTestId('menu-inventory'))

    expect(screen.queryByTestId('product-page')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('menu-pos'))

    expect(screen.getByTestId('product-page')).toBeInTheDocument()
  })

  it('should call onLogout when logout button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <MainPOS
        user={mockUser}
        onLogout={mockOnLogout}
      />
    )

    await user.click(screen.getByTestId('logout-button'))

    expect(mockOnLogout).toHaveBeenCalled()
  })

  it('should display customer count in order summary', () => {
    render(
      <MainPOS
        user={mockUser}
        onLogout={mockOnLogout}
      />
    )

    expect(screen.getByTestId('customer-count')).toHaveTextContent('1')
  })
})