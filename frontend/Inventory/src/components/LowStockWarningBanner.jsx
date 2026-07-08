import React from 'react';

export default function LowStockWarningBanner({ alertCount, onOpenPanel }) {
  if (alertCount === 0) return null;

  return (
    <div
      className="low-stock-banner"
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      data-testid="low-stock-banner"
    >
      <div className="banner-content">
        <span className="banner-icon">⚠️</span>
        <span className="banner-text">
          {alertCount} {alertCount === 1 ? 'item is' : 'items are'} low on stock
        </span>
        <button
          className="banner-action-btn"
          onClick={onOpenPanel}
          aria-label="View low stock alerts"
          data-testid="banner-view-alerts-btn"
        >
          View Alerts
        </button>
      </div>
    </div>
  );
};
