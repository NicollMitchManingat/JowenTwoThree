import '../../styles/ReceiptModal.css'

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
    <div className="modal-overlay" onClick={onClose} data-testid="receipt-modal">
      <div className="modal-content card receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-paper" data-testid="receipt">
          <div className="receipt-header">
            <h3>Jowen's Cafe</h3>
            <p className="receipt-subhead">Order Receipt</p>
          </div>

          <div className="receipt-meta">
            <div className="receipt-meta-row"><span>Date</span><span>{orderDate}</span></div>
            <div className="receipt-meta-row"><span>Customers</span><span>{customerCount}</span></div>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-items">
            {cart.map(item => (
              <div key={item.id} className="receipt-item" data-testid={`receipt-item-${item.id}`}>
                <div className="receipt-item-row">
                  <span className="receipt-item-name">{item.name}</span>
                  <span className="receipt-item-total">₱{(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <div className="receipt-item-qty">{item.quantity} x ₱{item.price.toFixed(2)}</div>
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
              <div className="receipt-total-row discount">
                <span>Discount {discountType === 'percentage' ? `(${discountValue}%)` : ''}</span>
                <span data-testid="receipt-discount">-₱{discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="receipt-total-row grand-total">
              <span>Total</span>
              <span data-testid="receipt-total">₱{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-footer">
            <p className="receipt-thankyou">Thank you!</p>
          </div>
        </div>

        <div className="receipt-actions no-print">
          <button className="btn btn-primary w-full" onClick={handlePrint} data-testid="print-receipt-btn">
            Print Receipt
          </button>
          <button className="btn btn-secondary w-full mt-2" onClick={onClose} data-testid="close-receipt-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}