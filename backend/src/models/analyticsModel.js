const salesRecords = [
  {
    id: "S-001",
    orderId: "ORD-1001",
    itemId: "I-001",
    itemName: "Burger",
    quantitySold: 8,
    totalSales: 960,
    date: "2026-07-01",
  },
  {
    id: "S-002",
    orderId: "ORD-1002",
    itemId: "I-002",
    itemName: "Fries",
    quantitySold: 12,
    totalSales: 720,
    date: "2026-07-01",
  },
  {
    id: "S-003",
    orderId: "ORD-1003",
    itemId: "I-003",
    itemName: "Milk Tea",
    quantitySold: 15,
    totalSales: 1800,
    date: "2026-07-01",
  },
]

const inventoryRecords = [
  {
    id: "I-001",
    itemName: "Burger Patty",
    category: "Food",
    stock: 45,
  },
  {
    id: "I-002",
    itemName: "French Fries",
    category: "Food",
    stock: 60,
  },
  {
    id: "I-003",
    itemName: "Milk Tea Powder",
    category: "Beverage",
    stock: 35,
  },
]

module.exports = {
  salesRecords,
  inventoryRecords,
}