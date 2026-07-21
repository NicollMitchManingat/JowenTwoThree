import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";

const app = require("../../src/app.js");
const TransactionService = require("../../src/services/transactionService.js");

const payload = {
  customerCount: 1,
  cart: [
    {
      id: 1,
      name: "Burger",
      price: 100,
      quantity: 1,
    },
  ],
  discountType: "none",
  discountValue: 0,
  paymentMethod: "CASH",
  cashReceived: 100,
  changeAmount: 0,
  specialInstructions: "No onions",
};

describe("End-to-End Transaction Workflow", () => {
  beforeEach(async () => {
    if (TransactionService.clearHistory) {
      TransactionService.clearHistory();
    }
  });

  it("should complete checkout, save transaction, and generate receipt", async () => {
    // 1. Create transaction
    const transactionResponse = await request(app)
      .post("/api/transactions")
      .send(payload);

    expect(transactionResponse.status).toBe(201);
    expect(transactionResponse.body.success).toBe(true);

    const transaction = transactionResponse.body.transaction;

    expect(transaction).toBeDefined();
    expect(transaction.transaction_number).toMatch(/^TXN-/);

    // 2. Verify transaction history
    const historyResponse = await request(app).get("/api/transactions/history");

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);
    expect(Array.isArray(historyResponse.body.history)).toBe(true);

    // 3. Generate receipt
    const receiptResponse = await request(app).get(
      `/api/transactions/${transaction.transaction_number}/receipt`
    );

    expect(receiptResponse.status).toBe(200);
    expect(receiptResponse.body.success).toBe(true);
    expect(receiptResponse.body.receipt.receiptId).toBe(
      transaction.transaction_number
    );
    expect(receiptResponse.body.receipt.items).toHaveLength(1);
    expect(receiptResponse.body.receipt.totalAmount).toBe(100);
  });
});