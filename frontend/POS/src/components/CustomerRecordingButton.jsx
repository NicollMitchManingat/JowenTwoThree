import { useState, useEffect } from 'react'
import '../styles/CustomerRecordingButton.css'

export default function CustomerRecordingButton({ count = 1, setCount = () => {} }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [inputValue, setInputValue] = useState(String(count))

  useEffect(() => {
    if (!isModalOpen) {
      setInputValue(String(count))
    }
  }, [count, isModalOpen])

  const handleOpen = () => {
    setInputValue(String(count))
    setIsModalOpen(true)
  }

  const handleClose = () => {
    setIsModalOpen(false)
  }

  const handleConfirm = () => {
    const parsed = parseInt(inputValue, 10)
    if (!isNaN(parsed) && parsed > 0) {
      setCount(parsed)
      handleClose()
    }
  }

  const handleIncrement = () => {
    const current = parseInt(inputValue, 10) || 1
    setInputValue(String(current + 1))
  }

  const handleDecrement = () => {
    const current = parseInt(inputValue, 10) || 1
    setInputValue(String(Math.max(1, current - 1)))
  }

  const draftCount = parseInt(inputValue, 10)
  const isValid = !isNaN(draftCount) && draftCount > 0

  return (
    <>
      <button
        type="button"
        className="customer-recording-button"
        onClick={handleOpen}
        data-testid="customer-recording-button"
      >
        Customers: {count}
      </button>

      {isModalOpen && (
        <div
          className="modal-overlay"
          data-testid="modal-overlay"
          onClick={handleClose}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="modal-title"
          >
            <h3 id="modal-title">Set Number of Customers</h3>

            <div className="customer-input-group">
              <button
                type="button"
                onClick={handleDecrement}
                data-testid="decrement-button"
                disabled={draftCount <= 1}
                aria-label="Decrease customer count"
              >
                -
              </button>

              <input
                type="number"
                min="1"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                data-testid="customer-input"
              />

              <button
                type="button"
                onClick={handleIncrement}
                data-testid="increment-button"
                aria-label="Increase customer count"
              >
                +
              </button>
            </div>

            <p data-testid="customer-count-display">
              Customers: {isValid ? draftCount : '-'}
            </p>

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleClose}
                data-testid="modal-cancel"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!isValid}
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