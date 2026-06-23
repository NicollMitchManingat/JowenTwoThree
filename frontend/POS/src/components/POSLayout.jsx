import React from "react";
import ProductPage from "./ProductPage";

const POSLayout = () => {
  return (
    <div>
      <header>
        <h1>POS Dashboard</h1>
      </header>

      <main>
        <section>
          <ProductPage />
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