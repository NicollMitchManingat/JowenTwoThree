import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'

describe('App Integration', () => {
  it('should render login page initially', () => {
    render(<App />)

    expect(screen.getByText('Jowen Two Three')).toBeInTheDocument()
    expect(screen.getByTestId('login-button')).toBeInTheDocument()
  })

  it('should navigate to main POS after login with admin credentials', async () => {
    const user = userEvent.setup()
    render(<App />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'admin@jowen.com')
    await user.type(passwordInput, 'admin123')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByText('Point-of-Sale')).toBeInTheDocument()
    })
  })

  it('should display user info in sidebar after login', async () => {
    const user = userEvent.setup()
    render(<App />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'cashier1')
    await user.type(emailInput, 'cashier1@jowen.com')
    await user.type(passwordInput, 'cashier123')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('cashier1')
    })
  })

  it('should show product page and order summary on POS view', async () => {
    const user = userEvent.setup()
    render(<App />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'admin@jowen.com')
    await user.type(passwordInput, 'admin123')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('product-page')).toBeInTheDocument()
      expect(screen.getByTestId('order-summary')).toBeInTheDocument()
    })
  })

  it('should return to login page after logout', async () => {
    const user = userEvent.setup()
    render(<App />)

    const usernameInput = screen.getByTestId('username-input')
    const emailInput = screen.getByTestId('email-input')
    const passwordInput = screen.getByTestId('password-input')
    const loginButton = screen.getByTestId('login-button')

    await user.type(usernameInput, 'admin')
    await user.type(emailInput, 'admin@jowen.com')
    await user.type(passwordInput, 'admin123')
    await user.click(loginButton)

    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    })

    const logoutButton = screen.getByTestId('logout-button')
    await user.click(logoutButton)

    await waitFor(() => {
      expect(screen.getByText('Jowen Two Three')).toBeInTheDocument()
      expect(screen.getByTestId('login-button')).toBeInTheDocument()
    })
  })
})
