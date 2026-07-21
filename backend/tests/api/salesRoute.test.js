const request = require("supertest")
const app = require("../../src/app")

const { inventory } = require("../../src/services/inventoryStore")

function getItem(itemId) {
  return inventory.find((i) => i.id === itemId)
}

function restoreItem(itemId, inStock, status) {
  const idx = inventory.findIndex((i) => i.id === itemId)
  inventory[idx] = { ...inventory[idx], inStock, status }
}

describe("Sales Route POS stock deduction", () => {
  describe("POST /api/sales/transactions", () => {
    it("decreases stock automatically after a sale", async () => {
      const milkBefore = getItem('I-002')
      const start = milkBefore.inStock
      const startStatus = milkBefore.status

      const res = await request(app)
        .post('/api/sales/transactions')
        .send({
          orderId: 'ORD-TEST-1',
          items: [
            { itemId: 'I-002', quantity: 1, itemName: 'Milk' },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.orderId).toBe('ORD-TEST-1')

      const after = getItem('I-002')
      expect(after.inStock).toBe(start - 1)
      expect(res.body.data.items[0].inStock).toBe(start - 1)

      restoreItem('I-002', start, startStatus)
    })

    it("prevents deduction below zero and returns 409", async () => {
      const milkBefore = getItem('I-002')
      const start = milkBefore.inStock
      const startStatus = milkBefore.status

      const res = await request(app)
        .post('/api/sales/transactions')
        .send({
          orderId: 'ORD-TEST-2',
          items: [
            { itemId: 'I-002', quantity: start + 1, itemName: 'Milk' },
          ],
        })

      expect(res.status).toBe(409)
      expect(res.body.success).toBe(false)
      expect(res.body.error.message).toMatch(/insufficient stock/i)

      const after = getItem('I-002')
      expect(after.inStock).toBe(start)

      restoreItem('I-002', start, startStatus)
    })

    it("keeps accurate inventory after multiple transactions", async () => {
      const coffeeBefore = getItem('I-001')
      const start = coffeeBefore.inStock
      const startStatus = coffeeBefore.status

      const res1 = await request(app)
        .post('/api/sales/transactions')
        .send({
          orderId: 'ORD-TEST-3-1',
          items: [{ itemId: 'I-001', quantity: 2, itemName: 'Coffee Beans' }],
        })

      expect(res1.status).toBe(201)

      const res2 = await request(app)
        .post('/api/sales/transactions')
        .send({
          orderId: 'ORD-TEST-3-2',
          items: [{ itemId: 'I-001', quantity: 3, itemName: 'Coffee Beans' }],
        })

      expect(res2.status).toBe(201)

      const after = getItem('I-001')
      expect(after.inStock).toBe(start - 5)

      // cleanup
      restoreItem('I-001', start, startStatus)
    })
  })
})