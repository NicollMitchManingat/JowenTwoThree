const { authenticateUser } = require('../data/mockUsers')

const login = ({ username, email, password }) => {
  return authenticateUser(username, email, password)
}

module.exports = {
  login
}

