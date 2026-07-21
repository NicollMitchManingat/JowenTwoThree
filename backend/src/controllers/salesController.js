const { getSalesData } = require("../services/salesService")
const stockDeductionService = require("../services/stockDeductionService")

function getSales(req, res) {
  try {
    const data = getSalesData()

    res.status(200).json({
      data,
    })
  } catch (err) {
    res.status(500).json({
      message: err.message,
    })
  }
}

async function createSaleTransaction(req, res) {
  // Payload: { orderId, items: [{ itemId, quantity, itemName }] }
  try {
    const { orderId, items } = req.body || {}

    if (typeof orderId !== 'string' || orderId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: { message: '`orderId` must be provided' },
      })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: '`items` must be a non-empty array' },
      })
    }

    // Negative-stock prevention: pre-validate first (no partial updates).
    // In-memory mode for OB2W5D1 current mock runtime.
    const stockOutcomes = []
    for (const it of items) {
      const itemId = it?.itemId
      const qty = Number(it?.quantity)
      if (!itemId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Each item must include `itemId`' },
        })
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Each item must include a positive numeric `quantity`' },
        })
      }
      stockOutcomes.push({ itemId, quantity: qty, itemName: it?.itemName })
    }
    
    const updatedItems = []
    for (const outcome of stockOutcomes) {
      // Deduct using stockDeductionService (negative protection)
      const updated = await stockDeductionService.deductStockForSale({
        itemId: outcome.itemId,
        quantity: outcome.quantity,
        reason: 'POS_SALE',
        mode: 'memory',
      })
      updatedItems.push({
        itemId: outcome.itemId,
        itemName: outcome.itemName,
        ...updated,
      })
    }

    return res.status(201).json({
      success: true,
      data: {
        orderId,
        items: updatedItems,
      },
    })
  } catch (err) {
    const status = err?.statusCode || 500
    return res.status(status).json({
      success: false,
      error: { message: err?.message || 'Internal server error' },
    })
  }
}

module.exports = {
  getSales,
  createSaleTransaction,
}
