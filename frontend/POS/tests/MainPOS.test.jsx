import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MainPOS from '../src/pages/MainPOS'

describe('MainPOS', () => {
  const mockUser = { username: 'testuser', email: 'test@example.com' }
  const mockOnLogout = vi.fn()

  it('should render main POS layout', () => {
    render(<MainPOS user={mockUser} onLogout={mockOnLogout} />)

    expect(screen.getByText('Point-of-Sale')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('product-page')).toBeInTheDocument()
    expect(screen.getByTestId('order-summary')).toBeInTheDocument()
  })

  it('should display customer recording button', () => {
    render(<MainPOS user={mockUser} onLogout={mockOnLogout} />)

    expect(screen.getByTestId('customer-recording-button')).toBeInTheDocument()
  })


  it('should navigate between menu items', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} onLogout={mockOnLogout} />)

    const inventoryMenu = screen.getByTestId('menu-inventory')
    await user.click(inventoryMenu)

    expect(screen.getByText('Inventory Module')).toBeInTheDocument()
  })

  it('should display POS content when POS menu is selected', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} onLogout={mockOnLogout} />)

    const inventoryMenu = screen.getByTestId('menu-inventory')
    await user.click(inventoryMenu)

    expect(screen.queryByTestId('product-page')).not.toBeInTheDocument()

    const posMenu = screen.getByTestId('menu-pos')
    await user.click(posMenu)

    expect(screen.getByTestId('product-page')).toBeInTheDocument()
  })

  it('should call onLogout when logout button is clicked', async () => {
    const user = userEvent.setup()
    render(<MainPOS user={mockUser} onLogout={mockOnLogout} />)

    const logoutButton = screen.getByTestId('logout-button')
    await user.click(logoutButton)

    expect(mockOnLogout).toHaveBeenCalled()
  })

  it('should display customer count in order summary', () => {
    render(<MainPOS user={mockUser} onLogout={mockOnLogout} />)

    expect(screen.getByTestId('customer-count')).toHaveTextContent('1')
  })

  
  
})
