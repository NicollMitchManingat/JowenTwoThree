import { describe, it, expect, beforeEach } from "vitest";

// Exercise the real service with a file-local memory adapter. A unit test must
// never load local credentials or insert synthetic sales into the live database.
const records = [];
const memoryClient = {
  from(table) {
    if (table !== 'transactions') throw new Error('Unexpected unit-test table');
    let inserted, filter;
    const query = {
      insert(values) { inserted = values; return query; },
      select() { return query; },
      eq(column, value) { filter = [column, value]; return query; },
      async order() { return { data: [...records].reverse(), error: null }; },
      async single() {
        if (inserted) {
          const row = { id: `unit-${records.length}`, created_at: new Date().toISOString(), ...inserted[0] };
          records.push(row); return { data: row, error: null };
        }
        return { data: records.find(row => row[filter?.[0]] === filter?.[1]) || null, error: null };
      },
    };
    return query;
  },
};
const servicePath = require.resolve('../../src/services/transactionService.js');
const localRequire = require('node:module').createRequire(servicePath);
const isolatedModule = { exports: {} };
const serviceCode = require('node:fs').readFileSync(servicePath, 'utf8');
const load = require('node:vm').runInThisContext(require('node:module').wrap(serviceCode), { filename: servicePath });
load(isolatedModule.exports, name => name === '../config/supabaseClient' ? { supabase: memoryClient } : localRequire(name),
  isolatedModule, servicePath, require('node:path').dirname(servicePath));
const TransactionService = isolatedModule.exports;

const createBaseProps = () => ({
  cart: [
    {
      id: 1,
      name: "Burger",
      price: 100,
      quantity: 2,
    },
    {
      id: 2,
      name: "Fries",
      price: 50,
      quantity: 1,
    },
  ],
  customerCount: 2,
  specialInstructions: "No onions",
  discountType: "none",
  discountValue: 0,
  paymentMethod: "CASH",
  cashReceived: 250,
  changeAmount: 0,
});

describe("TransactionService", () => {
  beforeEach(() => {
    records.length = 0;
    TransactionService.clearHistory();
  });

  describe("saveTransaction()", () => {
    it("should save transaction successfully", async () => {
      const saved = await TransactionService.saveTransaction(createBaseProps());

      expect(saved).toHaveProperty("transaction_number");
      expect(saved.cart).toHaveLength(2);

      const history = await TransactionService.getTransactionHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it("should return transactions ordered newest first", async () => {
      await TransactionService.saveTransaction(createBaseProps());

      await TransactionService.saveTransaction({
        ...createBaseProps(),
        discountType: "percentage",
        discountValue: 10,
      });

      const history = await TransactionService.getTransactionHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it("should throw error when cart is invalid", async () => {
      await expect(
        TransactionService.saveTransaction({
          ...createBaseProps(),
          cart: null,
        })
      ).rejects.toThrow("Cannot save transaction: Cart is invalid.");
    });
  });

  describe("Transaction Record Mapping", () => {
    it("should generate transaction metadata", async () => {
      const saved = await TransactionService.saveTransaction(createBaseProps());

      expect(saved).toHaveProperty("transaction_number");
      expect(saved).toHaveProperty("created_at");
      expect(saved.transaction_number).toMatch(/^TXN-/);
      expect(Date.parse(saved.created_at)).not.toBeNaN();
    });

    it("should correctly map transaction values", async () => {
      const saved = await TransactionService.saveTransaction(createBaseProps());

      expect(saved.customer_count).toBe(2);
      expect(saved.special_instructions).toBe("No onions");
      expect(saved.discount_type).toBe("none");
      expect(saved.discount_value).toBe(0);
      expect(saved.subtotal).toBe(250);
      expect(saved.discount).toBe(0);
      expect(saved.total).toBe(250);
    });

    it("should convert cart values to numbers", async () => {
      const saved = await TransactionService.saveTransaction({
        ...createBaseProps(),
        cart: [
          {
            id: 1,
            name: "Burger",
            price: "100",
            quantity: "2",
          },
        ],
      });

      expect(saved.cart[0].price).toBe(100);
      expect(saved.cart[0].quantity).toBe(2);
    });
  });

  describe("Additional Transaction Features", () => {
    it("should retrieve transaction by ID", async () => {
      const saved = await TransactionService.saveTransaction(createBaseProps());

      const result = await TransactionService.getTransactionById(
        saved.transaction_number
      );

      expect(result).toBeDefined();
      expect(result.transaction_number).toBe(saved.transaction_number);
    });

    it("should return undefined for invalid ID", async () => {
      const result = await TransactionService.getTransactionById("INVALID-ID");

      expect(result).toBeUndefined();
    });

    it("should format receipt correctly", async () => {
      const saved = await TransactionService.saveTransaction(createBaseProps());

      const receipt = TransactionService.formatReceipt(saved);

      expect(receipt).toEqual({
        receiptId: saved.transaction_number,
        createdAt: saved.created_at,
        customerCount: 2,
        maleCount: 0,
        femaleCount: 0,
        unspecifiedCount: 2,
        items: saved.cart,
        subtotal: 250,
        discountType: "none",
        discountValue: 0,
        discountAmount: 0,
        totalAmount: 250,
        specialInstructions: "No onions",
      });
    });
  });
});
