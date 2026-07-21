import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";

import app from "../../src/app";
const TransactionService =
  require("../../src/services/transactionService");

const payload = {
  cart: [
    {
      id: 1,
      name: "Burger",
      price: 100,
      quantity: 2
    }
  ],
  customerCount: 2,
  specialInstructions: "",
  discountType: "none",
  discountValue: 0,
  subtotal: 200,
  discountAmount: 0,
  totalAmount: 200
};

describe("Transaction Routes", () => {

  beforeEach(() => {
    TransactionService.clearHistory();
  });

  it("POST /api/transactions should save transaction", async () => {

    const response =
      await request(app)
        .post("/api/transactions")
        .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("GET /api/transactions/history should return all transactions", async () => {

    await request(app)
      .post("/api/transactions")
      .send(payload);

    const response =
      await request(app)
        .get("/api/transactions/history");

    expect(response.status).toBe(200);
    expect(response.body.history.length).toBe(1);
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
        .get(`/api/transactions/${id}/receipt`);

    expect(response.status).toBe(200);

    expect(response.body.receipt.receiptId)
      .toBe(id);

    expect(response.body.receipt.items.length)
      .toBe(1);
  });

  it("GET receipt should return 404 for invalid id", async () => {

    const response =
      await request(app)
        .get("/api/transactions/TXN-999999/receipt");

    expect(response.status).toBe(404);
  });

});