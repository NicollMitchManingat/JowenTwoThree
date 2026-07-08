import React from 'react';

export default function AlertCountIndicator({ count, onClick, hasUnread = false }) {
  return (
    <button
      className={`alert-count-indicator ${hasUnread ? 'alert-count-indicator--unread' : ''}`}
      onClick={onClick}
      aria-label={`${count} inventory alert${count !== 1 ? 's' : ''}`}
      data-testid="alert-count-indicator"
      title={`${count} alert${count !== 1 ? 's' : ''} requiring attention`}
    >
      <span className="alert-icon">🔔</span>
      {count > 0 && (
        <span
          className="alert-badge"
          data-testid="alert-badge"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
};
