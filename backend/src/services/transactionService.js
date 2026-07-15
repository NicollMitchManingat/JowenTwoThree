let transactionHistory = [];

class TransactionService {
  static clearHistory() {
    transactionHistory = [];
  }


  static saveTransaction(receiptPayload) {
    const {
      cart,
      customerCount,
      specialInstructions,
      discountType,
      discountValue,
      subtotal,
      discountAmount,
      totalAmount
    } = receiptPayload;

    if (!cart || !Array.isArray(cart)) {
      throw new Error("Cannot save transaction: Cart is invalid.");
    }

    const transactionRecord = {
      id: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      customerCount: Number(customerCount || 1),
      specialInstructions: specialInstructions || "",
      discountType: discountType || "none",
      discountValue: Number(discountValue || 0),
      subtotal: Number(subtotal),
      discountAmount: Number(discountAmount || 0),
      totalAmount: Number(totalAmount),
      cart: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity)
      }))
    };

    transactionHistory.push(transactionRecord);
    return transactionRecord;
  }


  static getTransactionHistory() {
    return [...transactionHistory].reverse();
  }
}

module.exports = TransactionService;