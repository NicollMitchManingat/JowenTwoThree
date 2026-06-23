import { useState } from "react";

function CustomerRecordingButton() {
  const [customerCount, setCustomerCount] = useState(1);

  const increaseCustomer = () => {
    setCustomerCount((prevCount) => prevCount + 1);
  };

  const decreaseCustomer = () => {
    setCustomerCount((prevCount) =>
      prevCount > 1 ? prevCount - 1 : 1
    );
  };

  return (
    <div className="customer-recording">
      <h2>Customer Count</h2>

      <button
        aria-label="Decrease Customer Count"
        onClick={decreaseCustomer}
      >
        -
      </button>

      <span data-testid="customer-count">
        {customerCount}
      </span>

      <button
        aria-label="Increase Customer Count"
        onClick={increaseCustomer}
      >
        +
      </button>
    </div>
  );
}

export default CustomerRecordingButton;