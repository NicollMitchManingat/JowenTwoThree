import { describe, test, expect, vi, beforeEach } from 'vitest'


vi.mock('../src/models/mockUsers', () => {
  return {
    mockUsers: mockedUsers
  }
})

import { login } from '../src/services/authService'

describe('Auth Service - login', () => {
  test('returns success and user details for valid credentials', () => {
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
  })

  test('returns success:false for invalid password', () => {
    const result = login({
      username: 'admin',
      email: 'admin@jowen.com',
      password: 'wrong-password'
    })

    expect(result).toEqual({
      success: false,
      error: 'Invalid username, email, or password'
    })
  })

  test('returns success:false for invalid username/email combination', () => {
    const result = login({
      username: 'not-a-user',
      email: 'admin@jowen.com',
      password: 'admin123'
    })

    expect(result).toEqual({
      success: false,
      error: 'Invalid username, email, or password'
    })
  })
})







