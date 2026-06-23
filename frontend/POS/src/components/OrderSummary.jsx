function OrderSummary() {
  const cartItems = [
    {
      id: 1,
      name: "Burger",
      quantity: 2,
      price: 120,
    },
    {
      id: 2,
      name: "Fries",
      quantity: 1,
      price: 80,
    },
  ];

  const total = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  return (
    <div className="order-summary">
      <h2>Order Summary</h2>

      {cartItems.length === 0 ? (
        <p>No items in cart.</p>
      ) : (
        <>
          <ul>
            {cartItems.map((item) => (
              <li key={item.id} data-testid="cart-item">
                <span>{item.name}</span>
                <span> x{item.quantity}</span>
                <span> - ₱{item.price * item.quantity}</span>
              </li>
            ))}
          </ul>

          <h3 data-testid="total-price">
            Total: ₱{total}
          </h3>
        </>
      )}
    </div>
  );
}

export default OrderSummary;