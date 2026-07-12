const salesRecords = require("../models/salesModel")
const { inventory } = require("./inventoryStore")

const sales = salesRecords.map((record) => ({ ...record }))

const inventoryData = inventory.map((item) => ({ ...item }))

module.exports = {
  sales,
  inventoryData,
}