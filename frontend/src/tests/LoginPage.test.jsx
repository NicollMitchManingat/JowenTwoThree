import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../pages/LoginPage'

describe('LoginPage - Authentication', () => {
  let mockOnLogin

  beforeEach(() => {
    mockOnLogin = vi.fn()
  })

  it('should render login page with title and form inputs', () => {
    render(<LoginPage onLogin={mockOnLogin} />)

    expect(screen.getByText("Jowen's Kitchen & Cafe")).toBeInTheDocument()
    expect(screen.getByText('Sign in to access the POS system')).toBeInTheDocument()
    expect(screen.getByTestId('username-input')).toBeInTheDocument()
    expect(screen.getByTestId('password-input')).toBeInTheDocument()
    expect(screen.getByTestId('login-button')).toBeInTheDocument()
  })

  it('should show error when username is empty', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    await user.click(screen.getByTestId('login-button'))

    expect(screen.getByTestId('error-message')).toHaveTextContent('Username and password are required')
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should show error when credentials are wrong', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    await user.type(screen.getByTestId('username-input'), 'wrong')
    await user.type(screen.getByTestId('password-input'), 'wrong')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid username or password')
    })
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should successfully login admin with correct credentials', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    await user.type(screen.getByTestId('username-input'), 'admin')
    await user.type(screen.getByTestId('password-input'), 'admin123')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith({ username: 'admin', role: 'admin' })
    })
  })

  it('should successfully login staff with correct credentials', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    await user.type(screen.getByTestId('username-input'), 'staff')
    await user.type(screen.getByTestId('password-input'), 'staff123')
    await user.click(screen.getByTestId('login-button'))

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith({ username: 'staff', role: 'staff' })
    })
  })

  it('should disable form inputs during login', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    await user.type(screen.getByTestId('username-input'), 'admin')
    await user.type(screen.getByTestId('password-input'), 'admin123')
    await user.click(screen.getByTestId('login-button'))

    expect(screen.getByTestId('login-button')).toBeDisabled()
  })

  it('should display demo credentials for testing', () => {
    render(<LoginPage onLogin={mockOnLogin} />)

    expect(screen.getByText('Demo Credentials:')).toBeInTheDocument()
    expect(screen.getByText('admin / admin123')).toBeInTheDocument()
    expect(screen.getByText('staff / staff123')).toBeInTheDocument()
  })
})
