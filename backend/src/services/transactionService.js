const crypto = require("crypto");
const { supabase } = require("../config/supabaseClient");

const {
  calculateSubtotal,
  calculateDiscount,
} = require("./calculationService");

let transactionHistory = [];

// Save transaction to Supabase
async function saveTransaction(data) {
  if (!Array.isArray(data.cart) || data.cart.length === 0) {
    throw new Error("Cannot save transaction: Cart is invalid.");
  }

  const cart = data.cart.map((item) => ({
    ...item,
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 1),
  }));

  // Backend calculation
  const subtotal = calculateSubtotal(cart);
  const discountType = data.discountType || "none";
  const discountValue = Number(data.discountValue || 0);

  const discountAmount = calculateDiscount(
    subtotal,
    discountType,
    discountValue
  );

  const totalAmount = subtotal - discountAmount;
  const transactionNumber = `TXN-${Date.now()}`;

  const transaction = {
    transaction_number: transactionNumber,
    idempotency_key: crypto.randomUUID(),
    subtotal,
    discount: discountAmount,
    total: totalAmount,
    payment_method: data.paymentMethod || "CASH",
    cash_received: Number(data.cashReceived || 0),
    change_amount: Number(data.changeAmount || 0),
    customer_count: Number(data.customerCount || 1),
    special_instructions: data.specialInstructions || "",
    discount_type: discountType,
    discount_value: discountValue,
    cart,
  };

  const { data: savedTransaction, error } = await supabase
    .from("transactions")
    .insert([transaction])
    .select()
    .single();

  if (error) {
    throw error;
  }

  transactionHistory.unshift(savedTransaction);

  return savedTransaction;
}

// Get transactions from Supabase
async function getTransactionHistory() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data;
}

// Get transaction by transaction number
async function getTransactionById(id) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("transaction_number", id)
    .single();

  if (error || !data) {
    return undefined;
  }

  return data;
}

// Receipt formatter
function formatReceipt(transaction) {
  return {
    receiptId: transaction.transaction_number,
    createdAt: transaction.created_at,
    customerCount: transaction.customer_count,
    items: transaction.cart,
    subtotal: transaction.subtotal,
    discountType: transaction.discount_type,
    discountValue: transaction.discount_value,
    discountAmount: transaction.discount,
    totalAmount: transaction.total,
    specialInstructions: transaction.special_instructions,
  };
}

// Used for tests only
function clearHistory() {
  transactionHistory = [];
}

module.exports = {
  saveTransaction,
  getTransactionHistory,
  getTransactionById,
  formatReceipt,
  clearHistory,
};