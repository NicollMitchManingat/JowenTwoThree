import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReceipt } from "../src/services/receiptAPI";

describe("receiptAPI.js - getReceipt()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch and return receipt successfully", async () => {
    const mockReceipt = {
      receiptId: "TXN-12345",
      createdAt: "2026-07-22T10:00:00Z",
      customerCount: 2,
      items: [
        {
          id: 1,
          name: "Burger",
          price: 100,
          quantity: 2,
        },
      ],
      subtotal: 200,
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      totalAmount: 200,
      specialInstructions: "",
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            receipt: mockReceipt,
          }),
      })
    );

    const result = await getReceipt("TXN-12345");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/transactions/TXN-12345/receipt"
    );
    expect(result).toEqual(mockReceipt);
  });

  it("should throw error when receipt generation fails", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () =>
          Promise.resolve({
            error: "Transaction not found",
          }),
      })
    );

    await expect(getReceipt("TXN-INVALID")).rejects.toThrow(
      "Transaction not found"
    );
  });
});