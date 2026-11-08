import { describe, it, expect } from 'vitest'
import { formatStock, inventoryTotal, formatInventoryMoney } from '../utils/formatStock'

describe('formatStock', () => {
  it.each([
    [0, '0'], [12, '12'], ['12.00', '12'],
    [0.25, '0.25'], ['8.50', '8.5'], [7.125, '7.125'],
  ])('displays %s without padding or rounding its quantity', (quantity, expected) => {
    expect(formatStock(quantity)).toBe(expected)
  })

  it.each(['invalid', undefined, null, '', NaN, Infinity])('uses a placeholder for %s', (quantity) => {
    expect(formatStock(quantity)).toBe('-')
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
