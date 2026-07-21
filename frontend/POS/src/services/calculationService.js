export function calculateSubtotal(cart) {
  return cart.reduce((total, item) => {
    return total + item.price * item.quantity
  }, 0)
}

export function calculateDiscount(subtotal, discountType, discountValue) {
  if (discountType === 'percentage') {
    return subtotal * (discountValue / 100)
  }

  if (discountType === 'fixed') {
    // Prevent the discount from exceeding the subtotal
    return Math.min(discountValue, subtotal)
  }

  return 0
}

export function calculateTax(subtotal, taxRate = 0.12) {
  return subtotal * taxRate
}