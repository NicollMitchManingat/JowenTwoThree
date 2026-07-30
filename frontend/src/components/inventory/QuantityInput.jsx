import React from 'react';

export default function QuantityInput({ value, onChange, min = 0, max = 9999, label = 'Quantity' }) {
  const handleChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue) && newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  return (
    <div className="quantity-input-group" data-testid="quantity-input-group">
      <label htmlFor="quantity-input" className="quantity-label">
        {label}
      </label>
      <div className="quantity-controls">
        <button
          type="button"
          className="quantity-btn"
          onClick={handleDecrement}
          disabled={value <= min}
          data-testid="quantity-decrement-btn"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <input
          id="quantity-input"
          type="number"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          className="quantity-input"
          data-testid="quantity-input"
          aria-label="Quantity input"
        />
        <button
          type="button"
          className="quantity-btn"
          onClick={handleIncrement}
          disabled={value >= max}
          data-testid="quantity-increment-btn"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
    </div>
  );
};
