const salesModel = require("../models/salesModel")
const { inventory } = require("./inventoryStore")

const sales = salesModel.getSales().map((record) => ({
  ...record,
}))

const inventoryData = inventory.map((item) => ({
  ...item,
}))

module.exports = {
  sales,
  inventoryData,
}