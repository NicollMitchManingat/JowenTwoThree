const crypto = require("crypto");
const { supabase } = require("../config/supabaseClient");

const {
  calculateSubtotal,
  calculateDiscount,
} = require("./calculationService");

let transactionHistory = [];

async function saveTransaction(data) {
  if (!Array.isArray(data.cart) || data.cart.length === 0) {
    throw new Error("Cannot save transaction: Cart is invalid.");
  }

  const subtotal = calculateSubtotal(data.cart);

  const discountAmount = calculateDiscount(
    subtotal,
    data.discountType,
    data.discountValue
  );

  const totalAmount = subtotal - discountAmount;

  const transaction = {
    id: `TXN-${Date.now()}`,
    customerCount: Number(data.customerCount || 1),
    cart: data.cart.map((item) => ({
      ...item,
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
    })),
    specialInstructions: data.specialInstructions || "",
    discountType: data.discountType || "none",
    discountValue: Number(data.discountValue || 0),
    subtotal,
    discountAmount,
    totalAmount,
    paymentMethod: data.paymentMethod || "CASH",
    cashReceived: Number(data.cashReceived || 0),
    changeAmount: Number(data.changeAmount || 0),
  };

  const { data: savedTransaction, error } = await supabase
    .from("transactions")
    .insert([
      {
        transaction_number: transaction.id,
        idempotency_key: crypto.randomUUID(),
        subtotal: transaction.subtotal,
        discount: transaction.discountAmount,
        total: transaction.totalAmount,
        payment_method: transaction.paymentMethod,
        cash_received: transaction.cashReceived,
        change_amount: transaction.changeAmount,
        customer_count: transaction.customerCount,
        special_instructions: transaction.specialInstructions,
        discount_type: transaction.discountType,
        discount_value: transaction.discountValue,
        cart: transaction.cart,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  transactionHistory.unshift(savedTransaction);

  return savedTransaction;
}

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

async function getTransactionById(id) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("transaction_number", id)
    .single();

  if (error) {
    return undefined;
  }

  return data;
}

function formatReceipt(transaction) {
  return {
    receiptId: transaction.transaction_number || transaction.id,
    createdAt: transaction.created_at || transaction.createdAt,
    customerCount: transaction.customer_count ?? transaction.customerCount,
    items: transaction.cart,
    subtotal: transaction.subtotal,
    discountType: transaction.discount_type ?? transaction.discountType,
    discountValue: transaction.discount_value ?? transaction.discountValue,
    discountAmount: transaction.discount ?? transaction.discountAmount,
    totalAmount: transaction.total ?? transaction.totalAmount,
    specialInstructions:
      transaction.special_instructions ?? transaction.specialInstructions,
  };
}

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