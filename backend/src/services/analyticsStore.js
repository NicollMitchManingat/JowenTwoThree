const {
  salesRecords,
  inventoryRecords,
} = require("../models/analyticsModel")

const sales = salesRecords.map((item) => ({ ...item }))
const inventory = inventoryRecords.map((item) => ({ ...item }))

module.exports = {
  sales,
  inventory,
}