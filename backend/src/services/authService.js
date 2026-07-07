const { authenticateUser } = require('../models/mockUsers')

const login = ({ username, email, password }) => {
  return authenticateUser(username, email, password)
}

module.exports = {
  login
}

