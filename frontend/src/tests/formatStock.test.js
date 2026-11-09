import { describe, it, expect } from 'vitest'
import { formatStock, inventoryTotal, formatInventoryMoney, formatUnitPrice, compareStock, subtractStock, addStock, isLowStock } from '../utils/formatStock'

describe('formatStock', () => {
  it.each([
    [0, '0'], [12, '12'], ['12.00', '12'],
    [0.25, '0.25'], ['8.50', '8.5'], [7.125, '7.125'],
    ['0.000000000000000123456789', '0.000000000000000123456789'],
    ['12345678901234567890.001', '12345678901234567890.001'], ['1e-7', '0.0000001'], ['0e3', '0'],
  ])('displays %s without padding or rounding its quantity', (quantity, expected) => {
    expect(formatStock(quantity)).toBe(expected)
  })

  it.each(['invalid', undefined, null, '', NaN, Infinity])('uses a placeholder for %s', (quantity) => {
    expect(formatStock(quantity)).toBe('-')
    expect(formatStock(quantity, { wholeNumber: true })).toBe('-')
  })

  it.each([[0, '0'], ['12.00', '12'], [7.125, '7'], ['8.50', '9'], [0.25, '0'], [7.875, '8']])(
    'rounds %s only for a whole-number display', (quantity, expected) => {
      expect(formatStock(quantity, { wholeNumber: true })).toBe(expected)
      expect(formatStock(quantity)).toBe(String(Number(quantity)))
    })
})

describe('unit-aware decimal display and thresholds', () => {
  it.each([['0.00123', '₱0.00123'], ['1.23000', '₱1.23'], ['0', '₱0.00'], ['1234.00000000000001', '₱1,234.00000000000001']])('preserves unit price %s', (value, expected) => expect(formatUnitPrice(value)).toBe(expected))
  it('compares and subtracts exact decimal stock balances', () => {
    expect(compareStock('1.00000000000000001', '1')).toBe(1)
    expect(subtractStock('1.00000000000000001', '0.00000000000000001')).toBe('1')
    expect(subtractStock('1', '2')).toBeNull()
    expect(addStock('0.00000000000000001', '0.01')).toBe('0.01000000000000001')
  })
  it('compares quantities to their own unit threshold including zero', () => {
    expect(isLowStock({ stock_quantity: '3000', low_stock_threshold: '5000' })).toBe(true)
    expect(isLowStock({ stock_quantity: '0.006', low_stock_threshold: '0.005' })).toBe(false)
    expect(isLowStock({ stock_quantity: '0.0001', low_stock_threshold: '0' })).toBe(false)
    expect(isLowStock({ stock_quantity: 4 })).toBe(true)
  })
})

describe('inventory valuation', () => {
  it.each([
    [2, 12.5, '25.00'], ['7.125', '85.20', '607.05'], ['1.005', 1, '1.01'],
    [0, 10, '0.00'], [10, 0, '0.00'], ['1e-7', 500000, '0.05'],
    [1, null, null], [1, '', null], [null, 1, null], [-1, 10, null],
    ['0.000000000000001', '9999999999.99', '0.00'],
  ])('values %s at %s without floating-point cent errors', (quantity, price, expected) => {
    expect(inventoryTotal(quantity, price)).toBe(expected)
  })
  it.each([[null, '-'], [0, '₱0.00'], ['607.05', '₱607.05'], ['99999999999999999.995', '₱100,000,000,000,000,000.00']])('formats %s as %s', (value, expected) => {
    expect(formatInventoryMoney(value)).toBe(expected)
  })
})
