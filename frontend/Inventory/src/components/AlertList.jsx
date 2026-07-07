import React from 'react';
import AlertItem from './AlertItem';

export default function AlertList({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="alert-empty-state" data-testid="alert-empty-state">
        <p>No inventory alerts at this time</p>
      </div>
    );
  }

  // Sort alerts: critical first, then by timestamp (newest first)
  const sortedAlerts = [...alerts].sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return (
    <div className="alert-list" role="list" data-testid="alert-list">
      {sortedAlerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </div>
  );
};
