const crypto = require("crypto");
const { supabase } = require("../config/supabaseClient");
const { calendarStart, DAY_MS, readAll } = require('./analyticsReadService');

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
  return readAll((start, stop) => supabase.from('transactions').select('*')
    .order('created_at', { ascending: false }).order('id').range(start, stop), { label: 'Transaction history' });
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

// Refund validation (pure — throws before any Supabase call).
// Money-only refunds: inventory is never restocked.
function validateRefundInput(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid refund data");
  }
  const { transaction_id, items, refund_amount, reason, approved_by } = data;
  if (!transaction_id) {
    throw new Error("Transaction id is required");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Select at least one item to refund");
  }
  const amount = Number(refund_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Refund amount must be greater than 0");
  }
  if (!String(reason || "").trim()) {
    throw new Error("A reason for the refund is required");
  }
  if (!String(approved_by || "").trim()) {
    throw new Error("Manager approval is required");
  }
  return {
    transaction_id,
    items,
    refund_amount: amount,
    reason: String(reason).trim(),
    notes: String(data.notes || "").trim() || null,
    approved_by: String(approved_by).trim(),
    created_by: data.created_by || null,
  };
}

// Append-only refund record + flip the transaction status.
// fullRefund=true → REFUNDED, otherwise PARTIALLY_REFUNDED.
async function recordRefund(data, fullRefund = false) {
  const clean = validateRefundInput(data);

  const { data: refund, error: refundError } = await supabase
    .from("refunds")
    .insert([clean])
    .select()
    .single();

  if (refundError) {
    throw refundError;
  }

  const { error: statusError } = await supabase
    .from("transactions")
    .update({ status: fullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED" })
    .eq("id", clean.transaction_id);

  if (statusError) {
    throw statusError;
  }

  return refund;
}

// Used for tests only
function clearHistory() {
  transactionHistory = [];
}

// Export reads are independent of the history page and its default REST row cap.
async function getTransactionExport({ from, to, client = supabase } = {}) {
  const first = calendarStart(from), last = calendarStart(to);
  if (!first || !last || first > last) throw Object.assign(new Error('Choose valid From and To dates in chronological order.'), { statusCode: 400 });
  const until = new Date(last.getTime() + DAY_MS).toISOString();
  const read = (table, unpaid = false) => readAll((start, stop) => {
    let query = client.from(table).select('*').gte('created_at', first.toISOString()).lt('created_at', until);
    if (unpaid) query = query.eq('payment_status', 'UNPAID').is('removed_at', null);
    return query.order('created_at', { ascending: false }).order('id').range(start, stop);
  }, { label: 'Transaction export' });
  const [paid, saved] = await Promise.all([read('transactions'), read('saved_orders', true)]);
  const { savedOrderRecord } = require('./checkoutService');
  const orders = [...new Map([...saved.map(savedOrderRecord), ...paid].map(row => [row.id, row])).values()]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const refundsByTxn = {}, ids = paid.map(row => row.id);
  // Keep URL filters bounded and fetch at most four groups concurrently.
  for (let offset = 0; offset < ids.length; offset += 400) {
    const batches = [];
    for (let i = offset; i < Math.min(offset + 400, ids.length); i += 100) {
      const group = ids.slice(i, i + 100);
      batches.push(readAll((start, stop) => client.from('refunds').select('*').in('transaction_id', group)
        .order('created_at').order('id').range(start, stop), { label: 'Transaction refunds' }));
    }
    for (const rows of await Promise.all(batches)) for (const refund of rows) {
      (refundsByTxn[refund.transaction_id] ||= []).push(refund);
    }
  }
  return { orders, refundsByTxn, range: { from, to }, dataQuality: { complete: true, timeZone: 'Asia/Manila' } };
}

module.exports = {
  getTransactionExport,
  saveTransaction,
  getTransactionHistory,
  getTransactionById,
  formatReceipt,
  validateRefundInput,
  recordRefund,
  clearHistory,
};
