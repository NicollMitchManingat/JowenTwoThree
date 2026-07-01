import '../styles/OrderSummary.css'
import OrderDetails from './OrderDetails'

export default function OrderSummary({
  cart,
  customerCount,
  onRemoveItem,
  onUpdateQuantity,
  onClearCart,
  onCheckout,
  specialInstructions,
  onSpecialInstructionsChange
}) {
  return (
    <div className="order-summary" data-testid="order-summary">
      <h2>Order Summary</h2>

      <OrderDetails
        cart={cart}
        customerCount={customerCount}
        onRemoveItem={onRemoveItem}
        onUpdateQuantity={onUpdateQuantity}
        onClearCart={onClearCart}
        onCheckout={onCheckout}
        specialInstructions={specialInstructions}
        onSpecialInstructionsChange={onSpecialInstructionsChange}
      />
    </div>
  )
}