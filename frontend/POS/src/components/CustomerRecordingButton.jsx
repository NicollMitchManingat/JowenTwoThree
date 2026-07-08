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
  }

  const handleConfirm = () => {
    const newCount = parseInt(inputValue, 10)
    if (!isNaN(newCount) && newCount > 0) {
      onCustomerCountChange(newCount)
      handleClose()
    }
  }

  const handleIncrement = () => {
    setInputValue((prev) => {
      const current = parseInt(prev, 10)
      const base = isNaN(current) ? 0 : current
      return (base + 1).toString()
    })
  }

  const handleDecrement = () => {
    setInputValue((prev) => {
      const current = parseInt(prev, 10)
      const base = isNaN(current) ? 1 : current
      return base > 1 ? (base - 1).toString() : '1'
    })
  }

  const draftCount = parseInt(inputValue, 10)
  const isDraftValid = !isNaN(draftCount) && draftCount > 0

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
                disabled={!isDraftValid || draftCount <= 1}
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
              Will set to: <span className="customer-count-display">{isDraftValid ? draftCount : '—'}</span>
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
                disabled={!isDraftValid}
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