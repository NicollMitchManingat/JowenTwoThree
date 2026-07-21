import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";

const app = require("../../src/app.js");

const TransactionService =
  require("../../src/services/transactionService.js");

const payload = {
  customerCount: 2,
  cart: [
    {
      id: 1,
      name: "Burger",
      price: 100,
      quantity: 2
    }
  ],

  subtotal: 200,
  discount: 0,
  total: 200,
  paymentMethod: "CASH",
  cashReceived: 200,
  changeAmount: 0,
  specialInstructions: ""
};

describe("Transaction Routes", () => {
  beforeEach(async () => {
    if (TransactionService.clearHistory) {
      await TransactionService.clearHistory();
    }
  });

  it("POST /api/transactions should save transaction", async () => {
    const response =
      await request(app)
        .post("/api/transactions")
        .send(payload);

    expect(response.status)
      .toBe(201);

    expect(response.body.success)
      .toBe(true);

    expect(response.body.transaction)
      .toBeDefined();

    expect(response.body.transaction.cart.length)
      .toBe(1);
  });

  it("POST should reject empty cart", async () => {
    const response =
      await request(app)
        .post("/api/transactions")
        .send({
          customerCount: 2,
          cart: []
        });

    expect(response.status)
      .toBe(400);

    expect(response.body.success)
      .toBe(false);
  });

  it("GET /api/transactions/history should return transactions", async () => {
    await request(app)
      .post("/api/transactions")
      .send(payload);

    const response =
      await request(app)
        .get("/api/transactions/history");

    expect(response.status)
      .toBe(200);

    expect(response.body.success)
      .toBe(true);

    expect(response.body.history)
      .toBeInstanceOf(Array);

    expect(response.body.history.length)
      .toBe(1);
  });

  it("GET receipt should return formatted receipt", async () => {
    const saved =
      await request(app)
        .post("/api/transactions")
        .send(payload);

    const id =
      saved.body.transaction.id;

    const response =
      await request(app)
        .get(
          `/api/transactions/${id}/receipt`
        );

    expect(response.status)
      .toBe(200);

    expect(response.body.success)
      .toBe(true);

    expect(response.body.receipt.receiptId)
      .toBe(id);

    expect(response.body.receipt.items)
      .toHaveLength(1);
  });


  it("GET receipt should return 404 for invalid transaction", async () => {
    const response =
      await request(app)
        .get(
          "/api/transactions/TXN-999999/receipt"
        );
      
    expect(response.status)
      .toBe(404);

    expect(response.body.success)
      .toBe(false);
  });

});