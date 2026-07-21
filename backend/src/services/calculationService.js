const calculateSubtotal = (cart) => {
  if (!Array.isArray(cart)) {
    throw new Error("Cart must be an array.")
  }

  return cart.reduce((total, item) => {
    return total + Number(item.price) * Number(item.quantity)
  }, 0)
}

const calculateDiscount = (subtotal, discountType, discountValue) => {
  const amount = Number(subtotal)
  const value = Number(discountValue)

  if (discountType === "percentage") {
    return (amount * value) / 100
  }

  if (discountType === "fixed") {
    return Math.min(value, amount)
  }

  return 0
}

module.exports = {
  calculateSubtotal,
  calculateDiscount
}