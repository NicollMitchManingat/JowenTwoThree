import { describe, it, expect, vi, afterEach } from "vitest";

const TransactionService = require("../../src/services/transactionService.js");

const validRefund = () => ({
  transaction_id: "txn-1",
  items: [{ productId: "p1", name: "Espresso", price: 150, qty: 1 }],
  refund_amount: 150,
  reason: "Double-charged",
  approved_by: "admin",
  created_by: "staff",
});

describe('Unpaid order removal authorization', () => {
  const checkout = require('../../src/services/checkoutService')
  const access = require('../../src/services/accessService')
  const id = '11111111-1111-4111-8111-111111111111'
  const context = { user: { role: 'cashier', permissions: ['transactions'] }, tokenHash: 'fixture-session' }
  afterEach(() => vi.restoreAllMocks())
  it('passes trusted session and revision to the protected RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id }, error: null })
    vi.spyOn(access, 'database').mockReturnValue({ rpc })
    expect(await checkout.removeSavedOrder(context, id, 2)).toEqual({ id })
    expect(rpc).toHaveBeenCalledWith('jowen_remove_saved_order', { p_session_hash: 'fixture-session', p_id: id, p_revision: 2 })
  })
  it.each([0, -1, 1.5, undefined, '2'])('rejects invalid revision %s before database access', async revision => {
    const db = vi.spyOn(access, 'database').mockImplementation(() => { throw new Error('Unexpected database access') })
    await expect(checkout.removeSavedOrder(context, id, revision)).rejects.toMatchObject({ statusCode: 400 })
    expect(db).not.toHaveBeenCalled()
  })
  it.each([{ role: 'stockist', permissions: ['transactions'] }, { role: 'cashier', permissions: [] }])('denies unauthorized account %j', async user => {
    await expect(checkout.removeSavedOrder({ ...context, user }, id, 1)).rejects.toMatchObject({ statusCode: 403 })
  })
  it.each([['ALREADY_PAID', 409], ['CONFLICT_SAVED_ORDER', 409], ['SAVED_ORDER_REMOVED', 409], ['SAVED_ORDER_NOT_FOUND', 404]])('maps %s to %s', async (message, statusCode) => {
    vi.spyOn(access, 'database').mockReturnValue({ rpc: vi.fn().mockResolvedValue({ error: { message } }) })
    await expect(checkout.removeSavedOrder(context, id, 1)).rejects.toMatchObject({ statusCode })
  })
})

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
