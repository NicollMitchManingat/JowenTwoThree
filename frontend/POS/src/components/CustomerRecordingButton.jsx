import { useState } from 'react'
import '../styles/CustomerRecordingButton.css'

export default function CustomerRecordingButton({ customerCount, onCustomerCountChange }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [inputValue, setInputValue] = useState(customerCount.toString())

  const handleOpen = () => {
    setIsModalOpen(true)
    setInputValue(customerCount.toString())
  }

  const handleClose = () => {
    setIsModalOpen(false)
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    onCustomerCountChange(1)
  }

  const handleConfirm = () => {
    const newCount = parseInt(inputValue, 10)
    if (!isNaN(newCount) && newCount > 0) {
      onCustomerCountChange(newCount)
      handleClose()
    }
  }

  const handleIncrement = () => {
    const newCount = customerCount + 1
    onCustomerCountChange(newCount)
  }

  const handleDecrement = () => {
    if (customerCount > 1) {
      onCustomerCountChange(customerCount - 1)
    }
  }

  return (
    <>
      <button
        className="customer-recording-button"
        onClick={handleOpen}
        data-testid="customer-recording-button"
        title="Click to set number of customers"
      >
        Customers: {customerCount}
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCancel} data-testid="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Set Number of Customers</h3>

            <p>How many customers ordered?</p>

            <div className="customer-input-group">
              <button
                className="btn-decrement"
                onClick={handleDecrement}
                disabled={customerCount <= 1}
                data-testid="decrement-button"
              >
                −
              </button>

              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                min="1"
                data-testid="customer-input"
                className="customer-input"
              />

              <button
                className="btn-increment"
                onClick={handleIncrement}
                data-testid="increment-button"
              >
                +
              </button>
            </div>

            <div className="modal-display">
              Current: <span className="customer-count-display">{customerCount}</span>
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={handleCancel}
                data-testid="modal-cancel"
              >
                Cancel
              </button>

              <button
                className="btn-confirm"
                onClick={handleConfirm}
                data-testid="modal-confirm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}