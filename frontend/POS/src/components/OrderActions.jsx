export default function OrderActions({ cart, onClearCart, onCheckout }) {
  return (
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
        Confirm
      </button>
    </div>
  )
}