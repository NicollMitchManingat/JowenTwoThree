let transactionHistory = [];

function saveTransaction(data) {

  if (!Array.isArray(data.cart) || data.cart.length === 0) {

    throw new Error(
      "Cannot save transaction: Cart is invalid."
    );
  }

  const transaction = {
    id: `TXN-${Date.now()}`,
    customerCount:
      Number(data.customerCount || 1),
    cart:
      data.cart.map(item => ({
        ...item,
        price:
          Number(item.price || 0),
        quantity:
          Number(item.quantity || 1)
      })),

    specialInstructions:
      data.specialInstructions || "",

    discountType:
      data.discountType || "none",

    discountValue:
      Number(data.discountValue || 0),

    subtotal:
      Number(data.subtotal || 0),

    discountAmount:
      Number(
        data.discountAmount ??
        data.discount ??
        0
      ),

    totalAmount:
      Number(
        data.totalAmount ??
        data.total ??
        0
      ),

    paymentMethod:
      data.paymentMethod || "CASH",

    cashReceived:
      Number(data.cashReceived || 0),

    changeAmount:
      Number(data.changeAmount || 0),

    createdAt:
      new Date()
  };

  transactionHistory.unshift(transaction);
  return transaction;
}

function getTransactionHistory(){
  return transactionHistory;
}

function getTransactionById(id){
  const transaction =
    transactionHistory.find(
      item => item.id === id
    );

  return transaction;
}

function formatReceipt(transaction){

  return {
    receiptId:
      transaction.id,
    createdAt:
      transaction.createdAt,
    customerCount:
      transaction.customerCount,
    items:
      transaction.cart,
    subtotal:
      transaction.subtotal,
    discountType:
      transaction.discountType,
    discountValue:
      transaction.discountValue,
    discountAmount:
      transaction.discountAmount,
    totalAmount:
      transaction.totalAmount,
    specialInstructions:
      transaction.specialInstructions
  };
}

function clearHistory(){
  transactionHistory = [];
}

module.exports = {
  saveTransaction,
  getTransactionHistory,
  getTransactionById,
  formatReceipt,
  clearHistory
};