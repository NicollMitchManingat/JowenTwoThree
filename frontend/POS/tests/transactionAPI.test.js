import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTransaction } from "../src/services/transactionAPI";

describe("transactionAPI", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("should send transaction data and return saved transaction", async () => {
    const mockResponse = {
      success: true,
      transaction: {
        id: "TXN-123",
        customerCount: 2,
        total: 200,
      },
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

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
      subtotal: 200,
      discount: 0,
      total: 200,
    };

    const result = await createTransaction(payload);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:5000/api/transactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    expect(result).toEqual(mockResponse);
  });

  it("should throw error when transaction saving fails", async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Invalid transaction data",
      }),
    });

    const payload = {
      customerCount: 0,
      cart: [],
    };

    await expect(createTransaction(payload)).rejects.toThrow(
      "Invalid transaction data"
    );
  });

  it("should throw default error when API fails without error message", async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    await expect(createTransaction({})).rejects.toThrow(
      "Failed to save transaction"
    );
  })
  
});

