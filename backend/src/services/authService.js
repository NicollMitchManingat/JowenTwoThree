const { mockUsers } = require('../models/mockUsers')

const login = ({ username, email, password }) => {
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
  login
}

