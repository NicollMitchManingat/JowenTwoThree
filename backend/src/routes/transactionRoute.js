const express = require("express");
const router = express.Router();

const TransactionService = require("../services/transactionService");

router.post("/", (req, res) => {
  try {
    const transaction =
      TransactionService.saveTransaction(req.body);

    return res.status(201).json({
      success: true,
      transaction
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/history", (req, res) => {
  const history =
    TransactionService.getTransactionHistory();

  return res.status(200).json({
    success: true,
    history
  });
});

router.get("/:id/receipt", (req, res) => {
  const transaction =
    TransactionService.getTransactionById(req.params.id);

  if (!transaction) {
    return res.status(404).json({
      success: false,
      error: "Transaction not found"
    });
  }

  const receipt =
    TransactionService.formatReceipt(transaction);

  return res.status(200).json({
    success: true,
    receipt
  });
});

module.exports = router;