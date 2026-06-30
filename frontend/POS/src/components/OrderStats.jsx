export default function OrderStats({ totalItems, customerCount }) {
  return (
    <div className="order-stats">
      <div className="stat">
        <span className="stat-label">Items:</span>
        <span className="stat-value" data-testid="total-items">{totalItems}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Customers:</span>
        <span className="stat-value" data-testid="customer-count">{customerCount}</span>
      </div>
    </div>
  )
}