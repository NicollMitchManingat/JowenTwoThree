import { useState } from 'react'
import { authenticateUser } from '../data/mockUsers'
import '../styles/LoginPage.css'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Validation
    if (!username.trim()) {
      setError('Username is required')
      setIsLoading(false)
      return
    }

    if (!email.trim()) {
      setError('Email is required')
      setIsLoading(false)
      return
    }

    if (!password.trim()) {
      setError('Password is required')
      setIsLoading(false)
      return
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email format')
      setIsLoading(false)
      return
    }

    // Simulate API call delay
    setTimeout(() => {
      // Authenticate user
      const result = authenticateUser(username, email, password)

      if (result.success) {
        onLogin(result.user)
      } else {
        setError(result.error)
      }

      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Jowen Two Three</h1>
        <p className="subtitle">Point-of-Sale System</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              data-testid="username-input"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              data-testid="email-input"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              data-testid="password-input"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="error-message" data-testid="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            data-testid="login-button"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="demo-credentials" data-testid="demo-credentials">
          <p className="demo-title">Demo Credentials:</p>
          <div className="demo-group">
            <strong>Admin:</strong>
            <p>Username: admin | Email: admin@jowen.com | Password: admin123</p>
          </div>
          <div className="demo-group">
            <strong>Cashier:</strong>
            <p>Username: cashier1 | Email: cashier1@jowen.com | Password: cashier123</p>
          </div>
        </div>
      </div>
    </div>
  )
}
