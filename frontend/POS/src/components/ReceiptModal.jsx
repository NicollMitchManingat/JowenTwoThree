import '../styles/ReceiptModal.css'

export default function ReceiptModal({
  isOpen,
  onClose,
  cart,
  customerCount,
  specialInstructions,
  discountType,
  discountValue,
  subtotal,
  discountAmount,
  totalAmount
}) {
  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  const orderDate = new Date().toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className="receipt-overlay" data-testid="receipt-modal">
      <div className="receipt-modal-content">

        <div className="receipt-modal-actions no-print">
          <button
            className="print-receipt-btn"
            onClick={handlePrint}
            data-testid="print-receipt-btn"
          >
            Print
          </button>
          <button
            className="close-receipt-btn"
            onClick={onClose}
            data-testid="close-receipt-btn"
          >
            Close
          </button>
        </div>

        <div className="receipt" data-testid="receipt">
          <div className="receipt-header">
            <h2>Order Receipt</h2>
            <p className="receipt-date">{orderDate}</p>
            <p className="receipt-customers">Customers: {customerCount}</p>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-items">
            {cart.map(item => (
              <div key={item.id} className="receipt-item" data-testid={`receipt-item-${item.id}`}>
                <div className="receipt-item-row">
                  <span className="receipt-item-name">{item.name}</span>
                  <span className="receipt-item-subtotal">
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
                <div className="receipt-item-detail">
                  {item.quantity} × ₱{item.price.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="receipt-divider" />

          {specialInstructions && (
            <>
              <div className="receipt-instructions">
                <p className="receipt-instructions-label">Special Instructions:</p>
                <p className="receipt-instructions-text">{specialInstructions}</p>
              </div>
              <div className="receipt-divider" />
            </>
          )}

          <div className="receipt-totals">
            <div className="receipt-total-row">
              <span>Subtotal</span>
              <span data-testid="receipt-subtotal">₱{subtotal.toFixed(2)}</span>
            </div>

            {discountType !== 'none' && (
              <div className="receipt-total-row receipt-discount-row">
                <span>
                  Discount {discountType === 'percentage' ? `(${discountValue}%)` : ''}
                </span>
                <span data-testid="receipt-discount">
                  -₱{discountAmount.toFixed(2)}
                </span>
              </div>
            )}

            <div className="receipt-total-row receipt-grand-total">
              <span>Total</span>
              <span data-testid="receipt-total">₱{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="receipt-divider" />

          <p className="receipt-footer">Thank you!</p>
        </div>

      </div>
    </div>
  )
}