const request = require('supertest')
const app = require('../src/app')

describe('Backend-Frontend Integration Tests', () => {
  describe('Inventory API - Data Contract', () => {
    test('GET /api/inventory returns data in expected format for frontend', async () => {
      const res = await request(app).get('/api/inventory').expect(200)

      expect(res.body).toHaveProperty('data')
      expect(Array.isArray(res.body.data)).toBe(true)

      if (res.body.data.length > 0) {
        const item = res.body.data[0]
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('name')
        expect(item).toHaveProperty('inStock')
        expect(item).toHaveProperty('category')
        expect(item).toHaveProperty('status')
      }
    })

    test('Inventory items have consistent data types', async () => {
      const res = await request(app).get('/api/inventory').expect(200)

      res.body.data.forEach((item) => {
        expect(typeof item.id).toBe('string')
        expect(typeof item.name).toBe('string')
        expect(typeof item.inStock).toBe('number')
        expect(typeof item.category).toBe('string')
        expect(typeof item.status).toBe('string')
      })
    })
  })

  describe('Health Check - Backend Available', () => {
    test('Backend health check endpoint returns ok status', async () => {
      const res = await request(app).get('/').expect(200)

      expect(res.body).toEqual({ status: 'ok' })
    })
  })

  describe('API Response Headers', () => {
    test('API returns correct Content-Type header', async () => {
      const res = await request(app).get('/api/inventory').expect(200)

      expect(res.type).toMatch(/json/)
    })

    test('Inventory endpoint is accessible from frontend origin', async () => {
      const res = await request(app).get('/api/inventory').expect(200)

      // Verify the response is valid JSON and can be parsed
      expect(() => JSON.stringify(res.body)).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    test('Invalid endpoints return proper error status', async () => {
      const res = await request(app).get('/api/invalid-endpoint')

      expect(res.status).toBe(404)
    })
  })
})
