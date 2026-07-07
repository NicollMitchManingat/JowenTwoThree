const request = require('supertest')
const app = require('../src/app')

describe('Auth API - Login', () => {
  test('POST /api/auth/login succeeds for admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        email: 'admin@jowen.com',
        password: 'admin123'
      })
      .expect(200)

    expect(res.body).toEqual({
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

  test('POST /api/auth/login fails with wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'wronguser',
        email: 'wrong@jowen.com',
        password: 'wrongpass'
      })
      .expect(401)

    expect(res.body).toEqual({
      success: false,
      error: 'Invalid username, email, or password'
    })
  })

  test('POST /api/auth/login requires all fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', email: 'admin@jowen.com' })
      .expect(400)

    expect(res.body).toEqual({
      success: false,
      error: 'Username, email, and password are required'
    })
  })
})

