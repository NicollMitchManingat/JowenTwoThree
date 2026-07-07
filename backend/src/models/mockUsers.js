const mockUsers = [
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
]

const authenticateUser = (username, email, password) => {
  const user = mockUsers.find(
    (u) => u.username === username && u.email === email && u.password === password
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

module.exports = {
  mockUsers,
  authenticateUser
}

