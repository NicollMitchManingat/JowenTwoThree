const customerTraffic = [
  {
    orderId: "ORD-001",
    timestamp: "2026-07-01T09:15:00",
  },
  {
    orderId: "ORD-002",
    timestamp: "2026-07-01T09:45:00",
  },
  {
    orderId: "ORD-003",
    timestamp: "2026-07-01T10:20:00",
  },
  {
    orderId: "ORD-004",
    timestamp: "2026-07-01T13:05:00",
  },
  {
    orderId: "ORD-005",
    timestamp: "2026-07-01T18:30:00",
  },
]

function getCustomerTraffic() {
  return customerTraffic
}

module.exports = {
  getCustomerTraffic,
}