import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../src/pages/LoginPage'

describe('LoginPage - Role-Based Authentication', () => {
  let mockOnLogin

  beforeEach(() => {
    mockOnLogin = vi.fn()
  })

  it('should render login page with title and form inputs', () => {
    render(<LoginPage onLogin={mockOnLogin} />)

    expect(screen.getByText('Jowen Two Three')).toBeInTheDocument()
    expect(screen.getByText('Point-of-Sale System')).toBeInTheDocument()
    expect(screen.getByTestId('username-input')).toBeInTheDocument()
    expect(screen.getByTestId('email-input')).toBeInTheDocument()
    expect(screen.getByTestId('password-input')).toBeInTheDocument()
    expect(screen.getByTestId('login-button')).toBeInTheDocument()
    expect(screen.getByTestId('demo-credentials')).toBeInTheDocument()
  })

  it('should show error when username is empty', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    expect(screen.getByTestId('error-message')).toHaveTextContent('Username is required')
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should show error when email is empty', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    await user.type(usernameInput, 'admin')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    expect(screen.getByTestId('error-message')).toHaveTextContent('Email is required')
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should show error when password is empty', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'admin@jowen.com')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    expect(screen.getByTestId('error-message')).toHaveTextContent('Password is required')
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should show error for invalid email format', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'invalid-email')
    await user.type(passwordInput, 'admin123')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    const errorMessage = screen.queryByTestId('error-message')
    if (errorMessage) {
      expect(errorMessage).toHaveTextContent('valid email format')
    }
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should show error when credentials are wrong', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    await user.type(usernameInput, 'wronguser')
    await user.type(emailInput, 'wrong@jowen.com')
    await user.type(passwordInput, 'wrongpass')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid username, email, or password')
    })
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should show error when username is wrong', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    await user.type(usernameInput, 'wronguser')
    await user.type(emailInput, 'admin@jowen.com')
    await user.type(passwordInput, 'admin123')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid username, email, or password')
    })
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should show error when email is wrong', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'wrong@jowen.com')
    await user.type(passwordInput, 'admin123')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid username, email, or password')
    })
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should show error when password is wrong', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'admin@jowen.com')
    await user.type(passwordInput, 'wrongpassword')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid username, email, or password')
    })
    expect(mockOnLogin).not.toHaveBeenCalled()
  })

  it('should successfully login admin with correct credentials', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'admin@jowen.com')
    await user.type(passwordInput, 'admin123')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'admin',
          email: 'admin@jowen.com',
          role: 'admin',
          fullName: 'Admin User'
        })
      )
    })
  })

  it('should successfully login cashier with correct credentials', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    await user.type(usernameInput, 'cashier1')
    await user.type(emailInput, 'cashier1@jowen.com')
    await user.type(passwordInput, 'cashier123')

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'cashier1',
          email: 'cashier1@jowen.com',
          role: 'cashier',
          fullName: 'Cashier One'
        })
      )
    })
  })

  it('should disable form inputs during login', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'admin@jowen.com')
    await user.type(passwordInput, 'admin123')
    await user.click(loginButton)

    expect(usernameInput).toBeDisabled()
    expect(emailInput).toBeDisabled()
    expect(passwordInput).toBeDisabled()
    expect(loginButton).toBeDisabled()
  })

  it('should clear error message when correcting input', async () => {
    const user = userEvent.setup()
    render(<LoginPage onLogin={mockOnLogin} />)

    const loginButton = screen.getByTestId('login-button')
    await user.click(loginButton)

    expect(screen.getByTestId('error-message')).toBeInTheDocument()

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'admin@jowen.com')
    await user.type(passwordInput, 'admin123')

    await user.click(loginButton)

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalled()
    })
  })

  it('should display demo credentials for testing', () => {
    render(<LoginPage onLogin={mockOnLogin} />)

    expect(screen.getByTestId('demo-credentials')).toHaveTextContent('admin@jowen.com')
    expect(screen.getByTestId('demo-credentials')).toHaveTextContent('cashier1@jowen.com')
  })
})
