const express = require("express");
const router = express.Router();

const TransactionService = require("../services/transactionService");

// Create transaction
router.post("/", async (req, res) => {
  try {
    const { customerCount, cart } = req.body;

    if (
      !customerCount ||
      customerCount <= 0 ||
      !Array.isArray(cart) ||
      cart.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid transaction data",
      });
    }

    const transaction = await TransactionService.saveTransaction(req.body);

    return res.status(201).json({
      success: true,
      message: "Transaction saved successfully",
      transaction,
    });
  } catch (error) {
    console.error("Transaction Save Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get transaction history from Supabase
router.get("/history", async (req, res) => {
  try {
    const history = await TransactionService.getTransactionHistory();

    return res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("Transaction History Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get all transactions
router.get("/", async (req, res) => {
  try {
    const transactions = await TransactionService.getTransactionHistory();

    return res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error("Get Transactions Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Record a refund (money-only; inventory is never restocked).
// Body: { transaction_id, items, refund_amount, reason, notes?, approved_by, created_by?, fullRefund? }
router.post("/:id/refund", async (req, res) => {
  try {
    const refund = await TransactionService.recordRefund(
      { ...req.body, transaction_id: req.params.id },
      req.body.fullRefund === true
    );

    return res.status(201).json({
      success: true,
      message: "Refund recorded successfully",
      refund,
    });
  } catch (error) {
    const status = /required|greater than 0|at least one/i.test(error.message)
      ? 400
      : 500;
    console.error("Refund Error:", error);

    return res.status(status).json({
      success: false,
      error: error.message,
    });
  }
});

// Generate receipt
router.get("/:id/receipt", async (req, res) => {
  try {
    const transaction = await TransactionService.getTransactionById(
      req.params.id
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    const receipt = TransactionService.formatReceipt(transaction);

    return res.status(200).json({
      success: true,
      receipt,
    });
  } catch (error) {
    console.error("Receipt Error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;