import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '../src/components/Sidebar'

describe('Sidebar', () => {
  const mockUser = { username: 'testuser' }
  const mockOnMenuChange = vi.fn()
  const mockOnLogout = vi.fn()

  it('should render sidebar with all menu items', () => {
    render(
      <Sidebar
        activeMenu="POS"
        onMenuChange={mockOnMenuChange}
        onLogout={mockOnLogout}
        user={mockUser}
      />
    )

    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByText('Jowen')).toBeInTheDocument()
    expect(screen.getByTestId('user-info')).toHaveTextContent('testuser')
    expect(screen.getByTestId('menu-pos')).toBeInTheDocument()
    expect(screen.getByTestId('menu-inventory')).toBeInTheDocument()
    expect(screen.getByTestId('menu-orders')).toBeInTheDocument()
    expect(screen.getByTestId('menu-settings')).toBeInTheDocument()
  })

  it('should display active menu item with active class', () => {
    render(
      <Sidebar
        activeMenu="POS"
        onMenuChange={mockOnMenuChange}
        onLogout={mockOnLogout}
        user={mockUser}
      />
    )

    const posMenu = screen.getByTestId('menu-pos')
    expect(posMenu).toHaveClass('active')
  })

  it('should call onMenuChange when a menu item is clicked', async () => {
    const user = userEvent.setup()
    render(
      <Sidebar
        activeMenu="POS"
        onMenuChange={mockOnMenuChange}
        onLogout={mockOnLogout}
        user={mockUser}
      />
    )

    const inventoryMenu = screen.getByTestId('menu-inventory')
    await user.click(inventoryMenu)

    expect(mockOnMenuChange).toHaveBeenCalledWith('Inventory')
  })

  it('should call onLogout when logout button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <Sidebar
        activeMenu="POS"
        onMenuChange={mockOnMenuChange}
        onLogout={mockOnLogout}
        user={mockUser}
      />
    )

    const logoutButton = screen.getByTestId('logout-button')
    await user.click(logoutButton)

    expect(mockOnLogout).toHaveBeenCalled()
  })

  it('should display username in user info section', () => {
    const testUser = { username: 'john_doe' }
    render(
      <Sidebar
        activeMenu="POS"
        onMenuChange={mockOnMenuChange}
        onLogout={mockOnLogout}
        user={testUser}
      />
    )

    expect(screen.getByTestId('user-info')).toHaveTextContent('john_doe')
  })

  it('should display "User" when username is not provided', () => {
    render(
      <Sidebar
        activeMenu="POS"
        onMenuChange={mockOnMenuChange}
        onLogout={mockOnLogout}
        user={null}
      />
    )

    expect(screen.getByTestId('user-info')).toHaveTextContent('User')
  })
})
