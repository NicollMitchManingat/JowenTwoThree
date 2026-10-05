import { Sparkles } from 'lucide-react'

function impactClass(impact) {
  if (impact === 'High' || impact === 'Reorder') return 'badge-danger'
  if (impact === 'Positive') return 'badge-success'
  return 'badge-warning'
}

export default function AiInsights({ insights, loading = false, error = null, onRetry }) {
  if (loading) {
    return (
      <div data-testid="insights-loading">
        <div className="prediction-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card prediction-card card-body">
              <div className="skeleton-block" style={{ width: '55%', height: '16px', marginBottom: '0.75rem' }} />
              <div className="skeleton-block" style={{ width: '70%', height: '28px', marginBottom: '0.5rem' }} />
              <div className="skeleton-block" style={{ width: '90%', height: '14px' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div data-testid="insights-error">
        <p className="text-sm text-muted" style={{ margin: '0 0 0.75rem 0' }}>
          {typeof error === 'string' ? error : error?.message || 'Failed to load insights.'}{' '}
          {onRetry && (
            <button
              data-testid="insights-retry"
              type="button"
              onClick={onRetry}
              style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'inherit' }}
            >
              Retry
            </button>
          )}
        </p>
      </div>
    )
  }

  if (!Array.isArray(insights) || insights.length === 0) {
    return (
      <p className="text-center text-muted py-4" data-testid="insights-empty">
        No insights yet — make some sales and check back.
      </p>
    )
  }

  return (
    <div className="prediction-grid">
      {insights.map((prediction) => (
        <div key={prediction.key || prediction.metric} className="card prediction-card card-body" data-testid={`insight-${prediction.key || prediction.metric}`}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" />
            <span className="font-semibold">{prediction.metric}</span>
          </div>
          <p className="text-2xl font-bold">{prediction.value}</p>
          <p className="text-sm text-muted">{prediction.insight}</p>
          <span className={`badge ${impactClass(prediction.impact)}`}>
            {prediction.impact}
          </span>
        </div>
      ))}
    </div>
  )
}
