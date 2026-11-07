import { describe, it, expect } from 'vitest'
import { formatStock } from '../utils/formatStock'

describe('formatStock', () => {
  it.each([
    [0, '0'], [12, '12'], ['12.00', '12'],
    [0.25, '0.25'], ['8.50', '8.5'], [7.125, '7.125'],
  ])('displays %s without padding or rounding its quantity', (quantity, expected) => {
    expect(formatStock(quantity)).toBe(expected)
  })

  it.each(['invalid', undefined, NaN, Infinity])('uses a placeholder for %s', (quantity) => {
    expect(formatStock(quantity)).toBe('-')
  })
})
