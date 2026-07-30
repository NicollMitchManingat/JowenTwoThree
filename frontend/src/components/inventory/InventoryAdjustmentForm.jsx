import React, { useState } from 'react';
import Modal from './Modal';
import QuantityInput from './QuantityInput';
import AdjustmentReasonDropdown from './AdjustmentReasonDropdown';

export default function InventoryAdjustmentForm({ isOpen, onClose, item, onSubmit }) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (reason === '') {
      alert('Please select an adjustment reason');
      return;
    }

    onSubmit({
      itemId: item.id,
      itemName: item.name,
      quantity,
      reason,
      notes,
      timestamp: new Date().toISOString(),
    });

    handleReset();
  };

  const handleReset = () => {
    setQuantity(1);
    setReason('');
    setNotes('');
    onClose();
  };

  if (!item) return null;

  const footer = (
    <div className="form-actions">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleReset}
        data-testid="form-cancel-btn"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="btn btn-primary"
        onClick={handleSubmit}
        data-testid="form-submit-btn"
      >
        Confirm Adjustment
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleReset} title="Adjust Inventory" footer={footer}>
      <form className="adjustment-form" data-testid="adjustment-form">
        <div className="form-group">
          <label className="form-label">Item Name</label>
          <div className="form-value" data-testid="item-name-display">
            {item.name}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Current Stock</label>
          <div className="form-value" data-testid="current-stock-display">
            {item.inStock} units
          </div>
        </div>

        <div className="form-group">
          <QuantityInput
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={9999}
            label="Adjustment Quantity"
          />
        </div>

        <div className="form-group">
          <AdjustmentReasonDropdown
            value={reason}
            onChange={setReason}
            label="Adjustment Reason"
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes" className="form-label">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-textarea"
            data-testid="notes-textarea"
            placeholder="Add any additional notes..."
            rows="3"
          />
        </div>
      </form>
    </Modal>
  );
};