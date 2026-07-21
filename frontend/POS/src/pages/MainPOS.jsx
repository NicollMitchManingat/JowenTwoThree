import { useState } from "react";

import { createTransaction } from "../services/transactionAPI";
import { getReceipt } from "../services/receiptAPI";

import Sidebar from "../components/Sidebar";
import ProductPage from "../components/ProductPage";
import OrderSummary from "../components/OrderSummary";
import CustomerRecordingButton from "../components/CustomerRecordingButton";
import ReceiptModal from "../components/ReceiptModal";

import {
  calculateSubtotal,
  calculateDiscount,
  calculateTotal
} from "../services/calculationService";

export default function MainPOS({ user, onLogout }) {
  const [cart, setCart] = useState([]);
  const [customerCount, setCustomerCount] = useState(1);
  const [activeMenu, setActiveMenu] = useState("POS");

  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const addToCart = (product) => {
    const existing = cart.find((item) => item.id === product.id);

    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    // Backend also recalculates these values.
    // These are only for frontend display/payload.
    const subtotal = calculateSubtotal(cart);
    const discountType = "none";
    const discountValue = 0;
    const discount = calculateDiscount(
      subtotal,
      discountType,
      discountValue
    );
    const total = calculateTotal(subtotal, discount);

    const payload = {
      customerCount,
      cart,
      subtotal,
      discount,
      total,
      discountType,
      discountValue,
      paymentMethod: "CASH",
      cashReceived: total,
      changeAmount: 0,
      specialInstructions: ""
    };

    console.log("Transaction Payload:", payload);

    try {
      const transaction = await createTransaction(payload);
      const generatedReceipt = await getReceipt(transaction.id);

      setReceipt(generatedReceipt);
      setShowReceipt(true);
      setCart([]);

      alert("Transaction successful");
    } catch (error) {
      console.error("Checkout Error:", error);
      alert(error.message);
    }
  };

  return (
    <div className="pos-layout">
      <Sidebar
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
        onLogout={onLogout}
        user={user}
      />

      <main className="pos-content">
        <h1>Point-of-Sale</h1>
        <p>Welcome {user?.username}</p>

        {activeMenu === "POS" && (
          <>
            <CustomerRecordingButton
              customerCount={customerCount}
              onCustomerCountChange={setCustomerCount}
            />

            <ProductPage onAddToCart={addToCart} />

            <OrderSummary
              cart={cart}
              customerCount={customerCount}
              onCheckout={handleCheckout}
            />
          </>
        )}

        {activeMenu === "Inventory" && (
          <div data-testid="inventory-page">Inventory Module</div>
        )}

        {activeMenu === "Orders" && (
          <div data-testid="orders-page">Orders Page</div>
        )}

        {activeMenu === "Settings" && (
          <div data-testid="settings-page">Settings Page</div>
        )}

        {showReceipt && (
          <ReceiptModal
            receipt={receipt}
            onClose={() => {
              setShowReceipt(false);
              setReceipt(null);
            }}
          />
        )}
      </main>
    </div>
  );
}