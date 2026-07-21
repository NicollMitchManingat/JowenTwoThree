import { useState } from 'react'
import '../styles/OrderSummary.css'
import ReceiptModal from './ReceiptModal'
import {
  calculateSubtotal,
  calculateDiscount
} from "../services/calculationService";

export default function OrderDetails({
  cart,
  customerCount,
  onRemoveItem,
  onUpdateQuantity,
  onClearCart,
  onCheckout,
  specialInstructions,
  onSpecialInstructionsChange
}) {
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [showReceipt, setShowReceipt] = useState(false)
  const [checkoutAttempted, setCheckoutAttempted] = useState(false)

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = calculateSubtotal(cart)
  const isCartEmpty = cart.length === 0

  const numericDiscountValue = Number(discountValue) || 0

  const discountAmount = calculateDiscount(
  subtotal,
  discountType,
  numericDiscountValue
)

const totalAmount = Math.max(0, subtotal - discountAmount)

  const discountError = (() => {
    if (discountType === 'none') return null
    if (isCartEmpty) {
      return 'Add an item to the cart before applying a discount.'
    }
    if (discountValue === '' || numericDiscountValue <= 0) {
      return 'Enter a discount value greater than 0.'
    }
    if (discountType === 'percentage' && numericDiscountValue >= 100) {
      return 'Discount cannot be 100% or more of the total amount.'
    }
    if (discountType === 'fixed' && numericDiscountValue >= subtotal) {
      return 'Discount cannot be equal to or greater than the total amount.'
    }
    return null
  })()

  const specialInstructionsError = isCartEmpty
    ? 'Add an item to the cart before adding special instructions.'
    : null

  const cartErrors = cart.reduce((errors, item) => {
    if (!item.quantity || item.quantity <= 0) {
      errors.push(`${item.name} has an invalid quantity.`)
    }
    return errors
  }, [])

  const canCheckout = cart.length > 0 && cartErrors.length === 0 && !discountError

  const resetDiscount = () => {
    setDiscountType('none')
    setDiscountValue('')
  }

  const handleCheckout = () => {
    setCheckoutAttempted(true)
    if (!canCheckout) return
    onCheckout()
    resetDiscount()
    setCheckoutAttempted(false)
  }

  const handleClearCart = () => {
    onClearCart()
    resetDiscount()
    setCheckoutAttempted(false)
  }

  return (
    <div className="order-details" data-testid="order-details">

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

      {checkoutAttempted && cartErrors.length > 0 && (
        <div className="cart-errors" data-testid="cart-errors">
          <ul>
            {cartErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="cart-items">
      
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

      </div>

      <div className="special-instructions">
        <label htmlFor="special-instructions-input" className="special-instructions-label">
          Special Instructions
        </label>
        <textarea
          id="special-instructions-input"
          className={`special-instructions-input${specialInstructionsError ? ' input-error' : ''}`}
          data-testid="special-instructions"
          placeholder="e.g. no sugar, allergies..."
          value={specialInstructions}
          onChange={(e) => onSpecialInstructionsChange(e.target.value)}
          disabled={isCartEmpty}
        />
        {specialInstructionsError && (
          <p className="special-instructions-error" data-testid="special-instructions-error">
            {specialInstructionsError}
          </p>
        )}
      </div>

      <div className="discount-section" data-testid="discount-section">
        <label className="discount-label">Discount</label>
        <div className="discount-controls">
          <select
            className="discount-type-select"
            value={discountType}
            onChange={(e) => { setDiscountType(e.target.value); setDiscountValue('') }}
            data-testid="discount-type-select"
            disabled={isCartEmpty}
          >
            <option value="none">No Discount</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (₱)</option>
          </select>

          {discountType !== 'none' && (
            <input
              type="number"
              className={`discount-value-input${discountError ? ' input-error' : ''}`}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
              min="0"
              max={discountType === 'percentage' ? 100 : subtotal}
              placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
              data-testid="discount-value-input"
              disabled={isCartEmpty}
            />
          )}
        </div>
        {discountError && (
          <p className="discount-error" data-testid="discount-error">{discountError}</p>
        )}
      </div>

      <div className="total-section" data-testid="total-section">
        <div className="total-row">
          <span className="total-label">Subtotal:</span>
          <span className="total-value" data-testid="subtotal-amount">₱{subtotal.toFixed(2)}</span>
        </div>

        {discountType !== 'none' && (
          <div className="total-row discount-row">
            <span className="total-label">
              Discount {discountType === 'percentage' ? `(${numericDiscountValue}%)` : ''}:
            </span>
            <span className="total-value discount-amount" data-testid="discount-amount">
              -₱{discountAmount.toFixed(2)}
            </span>
          </div>
        )}

        <div className="total-row grand-total">
          <span className="total-label">Total:</span>
          <span className="total-value" data-testid="total-amount">₱{totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div className="order-actions">
        <button
          className="clear-btn"
          onClick={handleClearCart}
          disabled={cart.length === 0}
          data-testid="clear-cart-btn"
        >
          Clear
        </button>
        <button
          className="print-btn"
          onClick={() => setShowReceipt(true)}
          disabled={cart.length === 0}
          data-testid="print-btn"
        >
          Print Receipt
        </button>
        <button
          className="checkout-btn"
          onClick={handleCheckout}
          disabled={cart.length === 0}
          data-testid="checkout-btn"
        >
          Confirm
        </button>
      </div>

      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        cart={cart}
        customerCount={customerCount}
        specialInstructions={specialInstructions}
        discountType={discountType}
        discountValue={numericDiscountValue}
        subtotal={subtotal}
        discountAmount={discountAmount}
        totalAmount={totalAmount}
      />
    </div>
  )
}