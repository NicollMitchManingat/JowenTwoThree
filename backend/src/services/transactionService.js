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
  const toCount = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 0);
  let male = toCount(data.male ?? data.male_count);
  let female = toCount(data.female ?? data.female_count);
  let unspecified = toCount(data.unspecified ?? data.unspecified_count);
  let customerCount = toCount(data.customerCount ?? data.customer_count);
  if (male + female + unspecified === 0 && customerCount > 0) {
    unspecified = customerCount;
  } else if (customerCount === 0) {
    customerCount = male + female + unspecified || 1;
  } else if (male + female + unspecified !== customerCount) {
    unspecified = Math.max(0, customerCount - male - female);
  }

  const transaction = {
    transaction_number: transactionNumber,
    idempotency_key: crypto.randomUUID(),
    subtotal,
    discount: discountAmount,
    total: totalAmount,
    payment_method: data.paymentMethod || "CASH",
    cash_received: Number(data.cashReceived || 0),
    change_amount: Number(data.changeAmount || 0),
    customer_count: customerCount,
    male_count: male,
    female_count: female,
    unspecified_count: unspecified,
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
    maleCount: transaction.male_count ?? 0,
    femaleCount: transaction.female_count ?? 0,
    unspecifiedCount: transaction.unspecified_count ?? 0,
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