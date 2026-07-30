import React from 'react';
import AlertList from './AlertList';

export default function AlertNotificationPanel({ isOpen, onClose, alerts }) {
  if (!isOpen) return null;

  return (
    <div
      className="alert-panel-overlay"
      onClick={onClose}
      role="presentation"
      data-testid="alert-panel-overlay"
    >
      <div
        className="alert-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Inventory alerts panel"
        aria-modal="true"
        data-testid="alert-panel"
      >
        <div className="alert-panel-header">
          <h2>Inventory Alerts</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close alerts panel"
            data-testid="alert-panel-close-btn"
          >
            ✕
          </button>
        </div>

        <div className="alert-panel-body">
          <AlertList alerts={alerts} />
        </div>

        <div className="alert-panel-footer">
          <p className="alert-count">
            {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'} requiring attention
          </p>
        </div>
      </div>
    </div>
  );
};
