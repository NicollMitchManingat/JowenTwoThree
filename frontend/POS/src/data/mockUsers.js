// Mock user database for authentication
export const mockUsers = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@jowen.com',
    password: 'admin123',
    role: 'admin',
    fullName: 'Admin User'
  },
  {
    id: '2',
    username: 'cashier1',
    email: 'cashier1@jowen.com',
    password: 'cashier123',
    role: 'cashier',
    fullName: 'Cashier One'
  },
  {
    id: '3',
    username: 'cashier2',
    email: 'cashier2@jowen.com',
    password: 'cashier123',
    role: 'cashier',
    fullName: 'Cashier Two'
  }
]

export const authenticateUser = (username, email, password) => {
  const user = mockUsers.find(
    u => u.username === username && u.email === email && u.password === password
  )

  if (!user) {
    return { success: false, error: 'Invalid username, email, or password' }
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    }
  }
}

export const getRoleLabel = (role) => {
  const labels = {
    admin: 'Administrator',
    cashier: 'Cashier'
  }
  return labels[role] || role
}
