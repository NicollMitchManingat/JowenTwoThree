export function calculateSubtotal(cart) {
  return cart.reduce(
    (total, item) => total + Number(item.price) * Number(item.quantity),
    0
  );
}

export function calculateDiscount(subtotal, discountType, discountValue) {
  if (discountType === "percentage") {
    return (subtotal * Number(discountValue)) / 100;
  }

  if (discountType === "fixed") {
    return Math.min(Number(discountValue), subtotal);
  }

  return 0;
}

export function calculateTotal(subtotal, discount) {
  return subtotal - discount;
}