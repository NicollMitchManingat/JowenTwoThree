import { useState } from 'react'
import { Coffee, Lock, User, Eye, EyeOff, ShieldCheck, Zap, ClipboardList, Loader2 } from 'lucide-react'
import '../styles/LoginPage.css'
import { authAPI } from '../services/authAPI'

function BrandIllustration() {
  return (
    <svg
      className="login-art"
      viewBox="0 0 340 230"
      fill="none"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMax meet"
    >
      {/* soft backdrop blobs */}
      <ellipse cx="170" cy="200" rx="140" ry="22" fill="#ffffff" opacity="0.08" />
      <circle cx="52" cy="52" r="3" fill="#d4a373" opacity="0.7" />
      <circle cx="78" cy="34" r="2" fill="#ffffff" opacity="0.4" />
      <circle cx="292" cy="44" r="2.5" fill="#d4a373" opacity="0.6" />
      <circle cx="310" cy="70" r="2" fill="#ffffff" opacity="0.35" />
      <circle cx="30" cy="110" r="2" fill="#ffffff" opacity="0.3" />

      {/* awning */}
      <rect x="62" y="46" width="216" height="14" rx="7" fill="#d4a373" />
      {Array.from({ length: 8 }).map((_, i) => (
        <path
          key={i}
          d={`M ${92 + i * 26} 60 v 16 a 13 13 0 0 1 -26 0 v -16 Z`}
          fill={i % 2 === 0 ? '#ffffff' : '#f3efe9'}
          opacity={i % 2 === 0 ? '0.95' : '0.75'}
        />
      ))}

      {/* shop body */}
      <rect x="76" y="92" width="188" height="86" rx="10" fill="#ffffff" opacity="0.12" />
      <rect x="76" y="92" width="188" height="86" rx="10" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* door */}
      <rect x="98" y="120" width="42" height="58" rx="6" fill="#2c2520" opacity="0.55" />
      <rect x="104" y="126" width="30" height="26" rx="4" fill="#d4a373" opacity="0.85" />
      <circle cx="132" cy="156" r="2.5" fill="#f9f7f3" />
      {/* window */}
      <rect x="152" y="120" width="90" height="40" rx="6" fill="#f9f7f3" opacity="0.9" />
      <rect x="152" y="120" width="90" height="40" rx="6" stroke="#d4a373" strokeWidth="2" />
      <line x1="197" y1="120" x2="197" y2="160" stroke="#d4a373" strokeWidth="2" />
      {/* cup on sill */}
      <path d="M176 140 h26 l-3 12 h-20 Z" fill="#4a3f35" />
      <path className="steam" d="M184 132 c -3 -5 3 -8 0 -13" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <path className="steam steam-delay" d="M192 132 c -3 -5 3 -8 0 -13" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

      {/* counter */}
      <rect x="66" y="178" width="208" height="12" rx="6" fill="#d4a373" />
      <rect x="66" y="190" width="208" height="8" rx="4" fill="#000000" opacity="0.25" />

      {/* big foreground latte cup */}
      <g>
        <ellipse cx="170" cy="214" rx="46" ry="7" fill="#000000" opacity="0.3" />
        <path d="M128 190 h84 l-7 20 a8 8 0 0 1 -8 6 h-54 a8 8 0 0 1 -8 -6 Z" fill="#f9f7f3" />
        <rect x="128" y="190" width="84" height="6" rx="3" fill="#d4a373" />
        <ellipse cx="170" cy="193" rx="32" ry="5" fill="#8c7b6c" />
        <ellipse cx="170" cy="193" rx="22" ry="3.5" fill="#d4a373" />
        <path d="M212 194 c 14 1 14 16 -2 17" stroke="#f9f7f3" strokeWidth="6" strokeLinecap="round" />
        <path className="steam" d="M160 178 c -4 -7 4 -10 0 -17" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <path className="steam steam-delay" d="M172 178 c -4 -7 4 -10 0 -17" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
        <path className="steam steam-delay-2" d="M184 178 c -4 -7 4 -10 0 -17" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      </g>

      {/* beans */}
      <g fill="#d4a373">
        <ellipse cx="66" cy="196" rx="7" ry="5" transform="rotate(-24 66 196)" opacity="0.9" />
        <ellipse cx="278" cy="198" rx="7" ry="5" transform="rotate(20 278 198)" opacity="0.9" />
        <ellipse cx="296" cy="120" rx="6" ry="4.5" transform="rotate(-30 296 120)" opacity="0.55" />
        <ellipse cx="46" cy="150" rx="5" ry="4" transform="rotate(28 46 150)" opacity="0.5" />
      </g>
      <g stroke="#4a3f35" strokeWidth="1.2" opacity="0.8">
        <path d="M61 193 q 5 3 10 6" />
        <path d="M273 196 q 5 2 10 4" />
      </g>
    </svg>
  )
}

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required')
      setIsLoading(false)
      return
    }

    try {
      // Backend (bcrypt) first; falls back to built-in accounts when offline.
      const user = await authAPI.login({ username, password })
      onLogin({ username: user.username, role: user.role })
    } catch (err) {
      setError(err?.message || 'Invalid username or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-brand">
          <div className="login-brand-inner">
            <div className="login-logo-badge">
              <Coffee size={28} strokeWidth={2.2} />
            </div>
            <h1>Jowen&apos;s Kitchen &amp; Cafe</h1>
            <p className="login-tagline">Point of sale, crafted for the daily rush.</p>
            <ul className="login-points">
              <li>
                <ShieldCheck size={17} />
                <span>Secure role-based sign in</span>
              </li>
              <li>
                <Zap size={17} />
                <span>Fast checkout &amp; orders</span>
              </li>
              <li>
                <ClipboardList size={17} />
                <span>Live menu &amp; inventory</span>
              </li>
            </ul>
            <BrandIllustration />
          </div>
        </aside>

        <div className="login-panel">
          <div className="login-card">
            <div className="login-header">
              <div className="login-mobile-badge">
                <Coffee size={22} />
              </div>
              <h2>Welcome back</h2>
              <p className="text-muted">Sign in to access the POS system</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form" noValidate>
              <div className="form-group">
                <label htmlFor="login-username">Username</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input
                    id="login-username"
                    type="text"
                    className="form-input"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter username"
                    disabled={isLoading}
                    autoComplete="username"
                    data-testid="username-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <div className="input-with-icon has-toggle">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={isLoading}
                    autoComplete="current-password"
                    data-testid="password-input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(v => !v)}
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && <div className="error-message" role="alert" data-testid="error-message">{error}</div>}

              <button type="submit" className="btn btn-primary w-full login-submit" disabled={isLoading} data-testid="login-button">
                {isLoading ? (
                  <>
                    <Loader2 size={17} className="spin" />
                    Signing in...
                  </>
                ) : (
                  'Secure Login'
                )}
              </button>
              <p className="login-secure-note">
                <Lock size={12} />
                Protected POS access
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
