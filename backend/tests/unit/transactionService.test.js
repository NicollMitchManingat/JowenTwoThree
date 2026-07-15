import { describe, it, expect, beforeEach } from 'vitest'
const TransactionService = require('../../src/services/transactionService.js')

const baseProps = {
  cart: [
    { id: 1, name: 'Burger', price: 100, quantity: 2 },
    { id: 2, name: 'Fries', price: 50, quantity: 1 }
  ],
  customerCount: 2,
  specialInstructions: 'No onions',
  discountType: 'none',
  discountValue: 0,
  subtotal: 250,
  discountAmount: 0,
  totalAmount: 250
}

describe('TransactionService', () => {
  beforeEach(() => {
    TransactionService.clearHistory()
  })

  it('Should successfully connect and save a transaction record from base props', () => {
    const savedRecord = TransactionService.saveTransaction(baseProps)

    expect(savedRecord).toHaveProperty('id')
    expect(savedRecord).toHaveProperty('createdAt')
    expect(savedRecord.id).toMatch(/^TXN-/)
    
    expect(savedRecord.customerCount).toBe(2)
    expect(savedRecord.specialInstructions).toBe('No onions')
    expect(savedRecord.totalAmount).toBe(250)
    expect(savedRecord.cart).toHaveLength(2)
    expect(savedRecord.cart[0].name).toBe('Burger')
  })

  it('Should retrieve saved transactions through the history logic', () => {
    TransactionService.saveTransaction(baseProps)

    const history = TransactionService.getTransactionHistory()

    expect(history).toBeInstanceOf(Array)
    expect(history).toHaveLength(1)
    expect(history[0].cart[1].name).toBe('Fries')
  })

  it('Should return a list of previous sales transactions accurately ordered by newest first', () => {
    TransactionService.saveTransaction(baseProps)

    const discountedProps = {
      ...baseProps,
      discountType: 'percentage',
      discountValue: 10,
      discountAmount: 25,
      totalAmount: 225
    }
    TransactionService.saveTransaction(discountedProps)

    const history = TransactionService.getTransactionHistory()

    expect(history).toHaveLength(2)
    
    expect(history[0].totalAmount).toBe(225)
    expect(history[0].discountAmount).toBe(25)
    
    expect(history[1].totalAmount).toBe(250)
    expect(history[1].discountAmount).toBe(0)
  })
})