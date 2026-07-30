export default function LoadingSkeleton() {
  const shimmer = "skeleton-shimmer";

  return (
    <div data-testid="loading-skeleton" className={shimmer} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="flex justify-between items-center">
        <div className="skeleton-block" style={{ width: '180px', height: '28px' }} />
        <div className="skeleton-block" style={{ width: '140px', height: '36px' }} />
      </div>

      <div className="metrics-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card">
            <div className="flex items-center gap-3">
              <div className="skeleton-icon" />
              <div style={{ flex: 1 }}>
                <div className="skeleton-block" style={{ width: '60%', height: '12px', marginBottom: '8px' }} />
                <div className="skeleton-block" style={{ width: '40%', height: '22px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        {[1, 2].map(i => (
          <div key={i} className="skeleton-card" style={{ height: '300px', padding: '1.25rem' }}>
            <div className="skeleton-block" style={{ width: '140px', height: '18px', marginBottom: '1rem' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '0.5rem', paddingTop: '1rem' }}>
              {[40, 65, 45, 80, 55, 70, 50, 75, 60, 85, 50, 65].map((h, j) => (
                <div key={j} className="skeleton-bar" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}