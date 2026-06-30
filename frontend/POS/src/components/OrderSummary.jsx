import '../styles/OrderSummary.css'
import OrderStats from './OrderStats'
import CartItemRow from './CartItemRow'
import SpecialInstructions from './SpecialInstructions'
import OrderActions from './OrderActions'

export default function OrderSummary({ cart, customerCount, onRemoveItem, onUpdateQuantity, onClearCart, onCheckout, specialInstructions, onSpecialInstructionsChange }) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const pricePerCustomer = customerCount > 0 ? totalPrice / customerCount : 0

  return (
    <div className="order-summary" data-testid="order-summary">
      <h2>Order Summary</h2>

      <OrderStats totalItems={totalItems} customerCount={customerCount} />

      <div className="cart-items">
        {cart.length === 0 ? (
          <div className="empty-cart" data-testid="empty-cart">
            Cart is empty
          </div>
        ) : (
          <div className="items-list">
            {cart.map(item => (
              <CartItemRow
                key={item.id}
                item={item}
                onRemoveItem={onRemoveItem}
                onUpdateQuantity={onUpdateQuantity}
              />
            ))}
          </div>
        )}
      </div>

      <SpecialInstructions
        specialInstructions={specialInstructions}
        onSpecialInstructionsChange={onSpecialInstructionsChange}
      />

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
