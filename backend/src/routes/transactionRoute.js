const express = require("express");
const router = express.Router();

const TransactionService =
  require("../services/transactionService");

router.post("/", async (req, res) => {

  try {
    const {
      customerCount,
      cart
    } = req.body;

    if (
      !customerCount ||
      customerCount <= 0 ||
      !Array.isArray(cart) ||
      cart.length === 0
    ) {

      return res.status(400).json({
        success: false,
        error: "Invalid transaction data"
      });
    }

    const transaction =
      TransactionService.saveTransaction(req.body);

    return res.status(201).json({
      success: true,
      message: "Transaction saved successfully",
      transaction
    });

  } catch (error) {

    console.error(
      "Transaction Save Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/history", async (req, res) => {

  try {
    const history =
      TransactionService.getTransactionHistory();

    return res.status(200).json({
      success: true,
      history
    });

  } catch (error) {
    console.error(
      "Transaction History Error:",
      error
    );

    return res.status(500).json({
      success:false,
      error:error.message
    });
  }
});

router.get("/:id/receipt", async (req,res)=>{

  try {
    const transaction =
      TransactionService.getTransactionById(
        req.params.id
      );

    if(!transaction){
      return res.status(404).json({
        success:false,
        error:"Transaction not found"
      });
    }

    const receipt =
      TransactionService.formatReceipt(
        transaction
      );

    return res.status(200).json({
      success:true,
      receipt
    });

  } catch(error) {
    console.error(
      "Receipt Error:",
      error
    );

    return res.status(500).json({
      success:false,
      error:error.message
    });
  }
});

module.exports = router;