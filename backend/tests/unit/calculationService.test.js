import { describe, it, expect } from "vitest"

const {
  calculateSubtotal,
  calculateDiscount
} = require("../../src/services/calculationService")

describe("Calculation Service", () => {

  describe("calculateSubtotal", () => {

    it("should calculate subtotal for multiple products", () => {
      const cart = [
        {
          id: 1,
          price: 100,
          quantity: 2
        },
        {
          id: 2,
          price: 50,
          quantity: 3
        }
      ]

      expect(calculateSubtotal(cart)).toBe(350)
    })

    it("should return zero for an empty cart", () => {
      expect(calculateSubtotal([])).toBe(0)
    })

    it("should convert string values into numbers", () => {
      const cart = [
        {
          id: 1,
          price: "150",
          quantity: "2"
        }
      ]

      expect(calculateSubtotal(cart)).toBe(300)
    })

    it("should throw an error when cart is not an array", () => {
      expect(() => {
        calculateSubtotal(null)
      }).toThrow("Cart must be an array.")
    })

  })

  describe("calculateDiscount", () => {

    it("should calculate percentage discount", () => {
      expect(
        calculateDiscount(1000, "percentage", 10)
      ).toBe(100)
    })

    it("should calculate fixed discount", () => {
      expect(
        calculateDiscount(1000, "fixed", 200)
      ).toBe(200)
    })

    it("should not exceed subtotal for fixed discount", () => {
      expect(
        calculateDiscount(500, "fixed", 1000)
      ).toBe(500)
    })

    it("should return zero when no discount is selected", () => {
      expect(
        calculateDiscount(1000, "none", 100)
      ).toBe(0)
    })

  })

})