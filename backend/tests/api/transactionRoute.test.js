import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";

const app = require("../../src/app.js");
const TransactionService = require("../../src/services/transactionService.js");

const payload = {
  customerCount: 2,
  cart: [
    {
      id: 1,
      name: "Burger",
      price: 100,
      quantity: 2,
    },
  ],

  discountType: "none",
  discountValue: 0,
  paymentMethod: "CASH",
  cashReceived: 200,
  changeAmount: 0,
  specialInstructions: "",
};

describe("Transaction Routes", () => {
  beforeEach(() => {
    TransactionService.clearHistory();
  });

  it("POST /api/transactions should save transaction", async () => {
    const response = await request(app)
      .post("/api/transactions")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.transaction).toBeDefined();
    expect(response.body.transaction.cart).toHaveLength(1);
    expect(response.body.transaction.transaction_number).toMatch(/^TXN-/);
    expect(response.body.transaction.subtotal).toBe(200);
    expect(response.body.transaction.discount).toBe(0);
    expect(response.body.transaction.total).toBe(200);
  });

  it("POST should reject empty cart", async () => {
    const response = await request(app)
      .post("/api/transactions")
      .send({
        customerCount: 2,
        cart: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/transactions/history should return transactions", async () => {
    await request(app)
      .post("/api/transactions")
      .send(payload);

    const response = await request(app)
      .get("/api/transactions/history");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.history).toBeInstanceOf(Array);
    expect(response.body.history.length).toBeGreaterThan(0);
  });

  it("GET receipt should return formatted receipt", async () => {
    const saved = await request(app)
      .post("/api/transactions")
      .send(payload);

    const id = saved.body.transaction.transaction_number;

    const response = await request(app)
      .get(`/api/transactions/${id}/receipt`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.receipt.receiptId).toBe(id);
    expect(response.body.receipt.items).toHaveLength(1);
    expect(response.body.receipt.subtotal).toBe(200);
    expect(response.body.receipt.totalAmount).toBe(200);
  });

  it("GET receipt should return 404 for invalid transaction", async () => {
    const response = await request(app)
      .get("/api/transactions/TXN-999999/receipt");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});