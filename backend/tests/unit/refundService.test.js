import { describe, it, expect } from "vitest";

const TransactionService = require("../../src/services/transactionService.js");

const validRefund = () => ({
  transaction_id: "txn-1",
  items: [{ productId: "p1", name: "Espresso", price: 150, qty: 1 }],
  refund_amount: 150,
  reason: "Double-charged",
  approved_by: "admin",
  created_by: "staff",
});

describe("Refund validation", () => {
  it("should accept a valid refund payload", () => {
    const clean = TransactionService.validateRefundInput(validRefund());
    expect(clean.refund_amount).toBe(150);
    expect(clean.reason).toBe("Double-charged");
  });

  it("should reject a refund with no items", () => {
    expect(() =>
      TransactionService.validateRefundInput({ ...validRefund(), items: [] })
    ).toThrow("at least one item");
  });

  it("should reject a non-positive refund amount", () => {
    expect(() =>
      TransactionService.validateRefundInput({ ...validRefund(), refund_amount: 0 })
    ).toThrow("greater than 0");
  });

  it("should reject a refund without a reason", () => {
    expect(() =>
      TransactionService.validateRefundInput({ ...validRefund(), reason: "  " })
    ).toThrow("reason");
  });

  it("should reject a refund without manager approval", () => {
    expect(() =>
      TransactionService.validateRefundInput({ ...validRefund(), approved_by: "" })
    ).toThrow("Manager approval");
  });

  it("should reject a refund without a transaction id", () => {
    expect(() =>
      TransactionService.validateRefundInput({ ...validRefund(), transaction_id: null })
    ).toThrow("Transaction id");
  });
});
