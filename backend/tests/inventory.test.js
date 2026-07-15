const request = require('supertest')
const app = require('../src/app')

describe('Inventory API', () => {
  test('GET /api/inventory returns items', async () => {
    const res = await request(app).get('/api/inventory').expect(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body).toHaveProperty('data')
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data[0]).toHaveProperty('id', 'I-001')

  })

  test('GET /api/inventory/alerts returns alerts', async () => {
    const res = await request(app).get('/api/inventory/alerts').expect(200)
    expect(res.body).toHaveProperty('data')
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data[0]).toHaveProperty('id', 'alert-1')
    expect(res.body.data[0]).toHaveProperty('severity')
  })

  test('GET / returns ok', async () => {
    const res = await request(app).get('/').expect(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

})

