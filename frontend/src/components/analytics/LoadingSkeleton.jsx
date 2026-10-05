function Block({ width = '100%', height = '14px', style }) {
  return (
    <div className="skeleton-block" style={{ width, height, ...style }} />
  )
}

function TableSkeleton({ columns = 4, rows = 6, testid }) {
  return (
    <div className="card table-card table-responsive" data-testid={testid}>
      <table className="data-table" aria-hidden="true">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}><Block width={`${[38, 24, 18, 20, 14][i % 5]}%`} height="14px" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  <Block
                    width={`${[62, 44, 30, 26, 18][(r + c) % 5]}%`}
                    height="14px"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
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
    </>
  )
}

// Mirrors MainPOS: header row, category pills, product grid, order column.
function PosSkeleton() {
  return (
    <div className="pos-container relative">
      <div className="pos-header">
        <div className="flex justify-between items-center w-full">
          <Block width="90px" height="24px" />
          <div className="flex items-center gap-2">
            <Block width="44px" height="38px" style={{ borderRadius: '10px' }} />
            <Block width="340px" height="52px" style={{ borderRadius: '10px' }} />
          </div>
        </div>
        <div className="flex justify-between items-center w-full flex-wrap gap-4">
          <div className="category-filters flex-1 m-0">
            {[96, 110, 84, 120, 92, 104].map((w, i) => (
              <div key={i} className="skeleton-block" style={{ width: `${w}px`, height: '30px', borderRadius: '20px', flexShrink: 0 }} />
            ))}
          </div>
          <Block width="220px" height="38px" style={{ borderRadius: '8px' }} />
        </div>
      </div>

      <div className="pos-grid mt-2" data-testid="loading-skeleton-pos-grid">
        <div className="menu-section">
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="skeleton-icon" style={{ marginBottom: '0.5rem' }} />
                <Block width="70%" height="14px" style={{ marginBottom: '0.25rem' }} />
                <Block width="40%" height="14px" />
              </div>
            ))}
          </div>
        </div>

        <div className="order-section card" data-testid="loading-skeleton-order" style={{ padding: '1rem' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <Block width="120px" height="20px" />
            <Block width="70px" height="22px" style={{ borderRadius: '20px' }} />
          </div>
          {[90, 76, 84].map((w, i) => (
            <div key={i} className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
              <Block width={`${w}%`} height="14px" />
            </div>
          ))}
          <Block width="100%" height="14px" style={{ margin: '1rem 0 0.5rem 0' }} />
          <Block width="60%" height="18px" style={{ marginBottom: '1rem' }} />
          <Block width="100%" height="44px" style={{ borderRadius: '8px' }} />
        </div>
      </div>
    </div>
  )
}

// Mirrors InventoryPage: action bar + data table.
function InventorySkeleton() {
  return (
    <>
      <div className="action-bar">
        <Block width="300px" height="40px" style={{ borderRadius: '8px' }} />
        <div className="flex items-center gap-2">
          <Block width="44px" height="44px" style={{ borderRadius: '8px' }} />
          <Block width="120px" height="44px" style={{ borderRadius: '8px' }} />
        </div>
      </div>
      <TableSkeleton columns={5} rows={6} testid="loading-skeleton-table" />
    </>
  )
}

// Mirrors OrderHistoryPage: 3 metric cards, action bar, data table.
function TransactionsSkeleton() {
  return (
    <>
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} data-testid="loading-skeleton-metrics">
        {[1, 2, 3].map(i => (
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

      <div className="action-bar">
        <Block width="300px" height="40px" style={{ borderRadius: '8px' }} />
        <Block width="110px" height="40px" style={{ borderRadius: '8px' }} />
      </div>
      <TableSkeleton columns={5} rows={6} testid="loading-skeleton-table" />
    </>
  )
}

const VARIANTS = {
  dashboard: { label: 'Loading analytics dashboard...', render: DashboardSkeleton },
  pos: { label: 'Loading menu...', render: PosSkeleton },
  inventory: { label: 'Loading inventory...', render: InventorySkeleton },
  transactions: { label: 'Loading transactions...', render: TransactionsSkeleton },
}

export default function LoadingSkeleton({ variant = 'dashboard' }) {
  const active = VARIANTS[variant] || VARIANTS.dashboard
  const Body = active.render

  return (
    <div
      data-testid="loading-skeleton"
      data-variant={variant in VARIANTS ? variant : 'dashboard'}
      role="status"
      aria-label={active.label}
      className="skeleton-shimmer"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <Body />
    </div>
  )
}
