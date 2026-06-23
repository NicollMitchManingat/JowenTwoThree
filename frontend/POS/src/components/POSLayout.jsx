import React from "react";

const POSLayout = () => {
  return (
    <div>
      <header>
        <h1>POS Dashboard</h1>
      </header>

      <main>
        <section>
          <h2>Products</h2>
          <p>Product display area</p>
        </section>

        <section>
          <h2>Order Summary</h2>
          <p>Cart and transaction details</p>
        </section>
      </main>
    </div>
  );
};

export default POSLayout;