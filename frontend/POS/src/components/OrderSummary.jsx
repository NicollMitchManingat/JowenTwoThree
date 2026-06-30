import '../styles/OrderSummary.css'

export default function OrderSummary({ cart, customerCount, onRemoveItem, onUpdateQuantity, onClearCart, onCheckout }) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const pricePerCustomer = customerCount > 0 ? totalPrice / customerCount : 0

  return (
    <div className="order-summary" data-testid="order-summary">
      <h2>Order Summary</h2>

      <div className="order-stats">
        <div className="stat">
          <span className="stat-label">Items:</span>
          <span className="stat-value" data-testid="total-items">{totalItems}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Customers:</span>
          <span className="stat-value" data-testid="customer-count">{customerCount}</span>
        </div>
      </div>

      <div className="cart-items">
        {cart.length === 0 ? (
          <div className="empty-cart" data-testid="empty-cart">
            Cart is empty
          </div>
        ) : (
          <div className="items-list">
            {cart.map(item => (
              <div key={item.id} className="cart-item" data-testid={`cart-item-${item.id}`}>
                <div className="item-details">
                  <span className="item-image"></span>
                  <div className="item-info">
                    <p className="item-name">{item.name}</p>
                    <p className="item-unit-price">₱{item.price}</p>
                  </div>
                </div>

                <div className="item-quantity-controls">
                  <button
                    className="qty-btn"
                    onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    data-testid={`decrease-qty-${item.id}`}
                  >
                    −
                  </button>
                  <span className="qty-display" data-testid={`qty-${item.id}`}>{item.quantity}</span>
                  <button
                    className="qty-btn"
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    data-testid={`increase-qty-${item.id}`}
                  >
                    +
                  </button>
                </div>

                <div className="item-total">
                  <p className="item-subtotal" data-testid={`subtotal-${item.id}`}>
                    ₱{item.price * item.quantity}
                  </p>
                  <button
                    className="remove-btn"
                    onClick={() => onRemoveItem(item.id)}
                    data-testid={`remove-${item.id}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="order-totals">
        <div className="total-row">
          <span>Subtotal:</span>
          <span data-testid="subtotal">₱{totalPrice}</span>
        </div>
        <div className="total-row per-customer">
          <span>Per Customer:</span>
          <span data-testid="per-customer">₱{pricePerCustomer.toFixed(2)}</span>
        </div>
        <div className="total-row grand-total">
          <span>Total:</span>
          <span data-testid="grand-total">₱{totalPrice}</span>
        </div>
      </div>

      <div className="order-actions">
        <button
          className="clear-btn"
          onClick={onClearCart}
          disabled={cart.length === 0}
          data-testid="clear-cart-btn"
        >
          Clear
        </button>
        <button
          className="checkout-btn"
          onClick={onCheckout}
          disabled={cart.length === 0}
          data-testid="checkout-btn"
        >
          Checkout
        </button>
      </div>
    </div>
  )
}
