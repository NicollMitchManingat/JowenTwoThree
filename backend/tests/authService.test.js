const { login } = require('../src/services/authService')

describe('Auth Service - Login', () => {
  test('should return the admin user for valid admin credentials', () => {
    const result = login({
      username: 'admin',
      email: 'admin@jowen.com',
      password: 'admin123'
    })

    expect(result).toEqual({
      success: true,
      user: {
        id: '1',
        username: 'admin',
        email: 'admin@jowen.com',
        role: 'admin',
        fullName: 'Admin User'
      }
    })
    expect(result.success).toBe(true)
    expect(result.user.username).toBe('admin')
  })

  test('should return the cashier user for valid cashier credentials', () => {
    const result = login({
      username: 'cashier1',
      email: 'cashier1@jowen.com',
      password: 'cashier123'
    })

    expect(result).toEqual({
      success: true,
      user: {
        id: '2',
        username: 'cashier1',
        email: 'cashier1@jowen.com',
        role: 'cashier',
        fullName: 'Cashier One'
      }
    })
    expect(result.success).toBe(true)
    expect(result.user.username).toBe('cashier1')
  })

  test('should return error for invalid credentials', () => {
    const result = login({
      username: 'wronguser',
      email: 'wrong@jowen.com',
      password: 'wrongpass'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('should return error when password is incorrect', () => {
    const result = login({
      username: 'admin',
      email: 'admin@jowen.com',
      password: 'wrongpassword'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})