import { useState } from 'react'
import { Coffee, Lock, User, Mail } from 'lucide-react'
import '../styles/LoginPage.css'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required')
      setIsLoading(false)
      return
    }

    setTimeout(() => {
      if (username === 'admin' && password === 'admin123') {
        onLogin({ username: 'admin', role: 'admin' })
      } else if (username === 'staff' && password === 'staff123') {
        onLogin({ username: 'staff', role: 'staff' })
      } else {
        setError('Invalid username or password')
      }
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="pin-overlay">
      <div className="card login-card">
        <div className="login-header">
          <Coffee size={48} className="login-icon" />
          <h2 className="text-primary">Jowen's Kitchen & Cafe</h2>
          <p className="text-muted">Sign in to access the POS system</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={isLoading}
                data-testid="username-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isLoading}
                data-testid="password-input"
              />
            </div>
          </div>

          {error && <div className="error-message" data-testid="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" disabled={isLoading} data-testid="login-button">
            {isLoading ? 'Signing in...' : 'Secure Login'}
          </button>
        </form>

        <div className="demo-credentials">
          <p className="font-semibold text-sm mb-2">Demo Credentials:</p>
          <div className="demo-group">
            <strong>Admin:</strong>
            <p>admin / admin123</p>
          </div>
          <div className="demo-group">
            <strong>Staff:</strong>
            <p>staff / staff123</p>
          </div>
        </div>
      </div>
    </div>
  )
}
