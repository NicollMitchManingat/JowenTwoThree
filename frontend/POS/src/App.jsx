import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import MainPOS from './pages/MainPOS'
import './App.css'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)

  const handleLogin = (credentials) => {
    setUser({
      username: credentials.username,
      email: credentials.email
    })
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setUser(null)
  }

  return (
    <div className="app">
      {isLoggedIn ? (
        <MainPOS user={user} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  )
}
