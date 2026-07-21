import { describe, it, expect, beforeEach } from "vitest";

const TransactionService =
  require("../../src/services/transactionService.js");

const createBaseProps = () => ({
  cart: [
    {
      id: 1,
      name: "Burger",
      price: 100,
      quantity: 2
    },
    {
      id: 2,
      name: "Fries",
      price: 50,
      quantity: 1
    }
  ],

  customerCount: 2,
  specialInstructions:
    "No onions",
  discountType:
    "none",
  discountValue:
    0,
  subtotal:
    250,
  discountAmount:
    0,
  totalAmount:
    250
});


describe("TransactionService", () => {
  beforeEach(() => {
    TransactionService.clearHistory();
  });

  describe("saveTransaction()", () => {
    it("should save transaction successfully", () => {
      const saved =
        TransactionService.saveTransaction(
          createBaseProps()
        );

      expect(saved).toHaveProperty("id");
      expect(saved.cart)
        .toHaveLength(2);

      const history =
        TransactionService.getTransactionHistory();

      expect(history)
        .toHaveLength(1);
    });

    it("should return transactions ordered newest first", () => {
      TransactionService.saveTransaction(
        createBaseProps()
      );

      TransactionService.saveTransaction({
        ...createBaseProps(),
        discountType:"percentage",
        discountValue:10,
        discountAmount:25,
        totalAmount:225
      });

      const history =
        TransactionService.getTransactionHistory();

      expect(history)
        .toHaveLength(2);

      expect(history[0].totalAmount)
        .toBe(225);

      expect(history[1].totalAmount)
        .toBe(250);
    });

    it("should throw error when cart is invalid",()=>{
      expect(()=>{
        TransactionService.saveTransaction({
          ...createBaseProps(),
          cart:null
        });

      }).toThrow(
        "Cannot save transaction: Cart is invalid."
      );
    });
  });

  describe("Transaction Record Mapping",()=>{
    it("should generate transaction metadata",()=>{
      const saved =
        TransactionService.saveTransaction(
          createBaseProps()
        );
      expect(saved)
        .toHaveProperty("id");
      expect(saved)
        .toHaveProperty("createdAt");
      expect(saved.id)
        .toMatch(/^TXN-/);
      expect(
        Date.parse(saved.createdAt)
      )
      .not
      .toBeNaN();
    });

    it("should correctly map transaction values",()=>{
      const saved =
        TransactionService.saveTransaction(
          createBaseProps()
        );

      expect(saved.customerCount)
        .toBe(2);
      expect(saved.specialInstructions)
        .toBe("No onions");
      expect(saved.discountType)
        .toBe("none");
      expect(saved.discountValue)
        .toBe(0);
      expect(saved.subtotal)
        .toBe(250);
      expect(saved.totalAmount)
        .toBe(250);
    });


    it("should convert cart values to numbers",()=>{
      const saved =
        TransactionService.saveTransaction({
          ...createBaseProps(),
          cart:[
            {
              id:1,
              name:"Burger",
              price:"100",
              quantity:"2"
            }
          ]
        });

      expect(saved.cart[0].price)
        .toBe(100);

      expect(saved.cart[0].quantity)
        .toBe(2);
    });
  });

  describe("Additional Transaction Features",()=>{
    it("should retrieve transaction by ID",()=>{
      const saved =
        TransactionService.saveTransaction(
          createBaseProps()
        );

      const result =
        TransactionService.getTransactionById(
          saved.id
        );

      expect(result)
        .toBeDefined();

      expect(result.id)
        .toBe(saved.id);
    });

    it("should return undefined for invalid ID",()=>{
      const result =
        TransactionService.getTransactionById(
          "TXN-INVALID"
        );

      expect(result)
        .toBeUndefined();
    });

    it("should format receipt correctly",()=>{
      const saved =
        TransactionService.saveTransaction(
          createBaseProps()
        );

      const receipt =
        TransactionService.formatReceipt(
          saved
        );

      expect(receipt)
      .toEqual({
        receiptId:saved.id,
        createdAt:saved.createdAt,
        customerCount:2,
        items:saved.cart,
        subtotal:250,
        discountType:"none",
        discountValue:0,
        discountAmount:0,
        totalAmount:250,
        specialInstructions:"No onions"
      });
    });
  });
});