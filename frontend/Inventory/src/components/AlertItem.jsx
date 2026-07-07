import React from 'react';

export default function AlertItem({ alert }) {
  const formatTime = (timestamp) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - new Date(timestamp)) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const stockPercentage = (alert.currentStock / alert.threshold) * 100;

  return (
    <div
      className={`alert-item alert-item--${alert.severity}`}
      role="listitem"
      data-testid={`alert-item-${alert.id}`}
    >
      <div className="alert-item-header">
        <div className="alert-item-title">
          <span className={`alert-severity-badge alert-severity-badge--${alert.severity}`}>
            {alert.severity === 'critical' ? '🔴' : '🟡'}
          </span>
          <span className="alert-item-product" data-testid={`alert-product-${alert.id}`}>
            {alert.itemName}
          </span>
        </div>
        <span className="alert-timestamp" data-testid={`alert-time-${alert.id}`}>
          {formatTime(alert.timestamp)}
        </span>
      </div>

      <p className="alert-message" data-testid={`alert-message-${alert.id}`}>
        {alert.message}
      </p>

      <div className="alert-item-details">
        <div className="alert-detail">
          <span className="label">Item ID:</span>
          <span className="value" data-testid={`alert-itemid-${alert.id}`}>
            {alert.itemId}
          </span>
        </div>
        <div className="alert-detail">
          <span className="label">Category:</span>
          <span className="value" data-testid={`alert-category-${alert.id}`}>
            {/* Category can be derived from itemId if needed */}
            {alert.category || 'General'}
          </span>
        </div>
      </div>

      <div className="alert-stock-info">
        <div className="stock-bar-container">
          <div className="stock-bar-label">
            <span className="current-stock" data-testid={`alert-current-${alert.id}`}>
              Current: {alert.currentStock} units
            </span>
            <span className="threshold-stock">
              Threshold: {alert.threshold} units
            </span>
          </div>
          <div className="stock-bar">
            <div
              className={`stock-bar-fill stock-bar-fill--${alert.severity}`}
              style={{
                width: `${Math.min(stockPercentage, 100)}%`,
              }}
              data-testid={`alert-bar-${alert.id}`}
            />
          </div>
        </div>
      </div>

      <div className="alert-actions">
        <button
          className="alert-action-btn alert-action-btn--primary"
          data-testid={`alert-reorder-${alert.id}`}
          aria-label={`Reorder ${alert.itemName}`}
        >
          Reorder Now
        </button>
      </div>
    </div>
  );
};
