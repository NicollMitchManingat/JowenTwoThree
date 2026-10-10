import { useState } from 'react'
import { Sparkles } from 'lucide-react'

// Same-origin by default so the Vercel `/api` rewrite reaches the backend.
// Set VITE_API_URL=http://localhost:3001 for local `vite dev` without a proxy.
const EXPLAIN_API_BASE = import.meta.env.VITE_API_URL || ""

function impactClass(impact) {
  if (impact === 'High' || impact === 'Reorder') return 'badge-danger'
  if (impact === 'Positive') return 'badge-success'
  return 'badge-warning'
}

function templateSentence(prediction) {
  const value = prediction?.value || ''
  const finding = prediction?.insight || ''
  return `${value} — ${finding}`.replace(/^ — | — $/g, '').trim()
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

  // Per-card narration: key → 'loading' | { text, source }.
  // Any failure falls back to the template sentence locally — staff see
  // plainer wording, never an error.
  const [explained, setExplained] = useState({})

  const explain = async (prediction) => {
    const key = prediction.key || prediction.metric
    setExplained((prev) => ({ ...prev, [key]: 'loading' }))
    const payload = {
      key: prediction.key,
      metric: prediction.metric,
      value: prediction.value,
      insight: prediction.insight,
      impact: prediction.impact,
      numbers: Array.isArray(prediction.numbers) ? prediction.numbers : [],
    }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`${EXPLAIN_API_BASE}/api/ai-insights/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight: payload }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error('Explain request failed.')
      const json = await res.json()
      setExplained((prev) => ({ ...prev, [key]: { text: json.text, source: json.source } }))
    } catch {
      setExplained((prev) => ({ ...prev, [key]: { text: templateSentence(prediction), source: 'template' } }))
    }
  }

  return (
    <div className="prediction-grid">
      {insights.map((prediction) => {
        const key = prediction.key || prediction.metric
        const state = explained[key]
        const narrated = state && state !== 'loading' ? state.text : null
        return (
          <div key={key} className="card prediction-card card-body" data-testid={`insight-${key}`}>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <span className="font-semibold">{prediction.metric}</span>
            </div>
            <p className="text-2xl font-bold">{prediction.value}</p>
            {narrated ? (
              <p className="text-sm text-muted" data-testid={`insight-explained-${key}`}>
                {narrated}{' '}
                {state.source && state.source !== 'template' && (
                  <Sparkles size={12} className="text-primary" title={`AI narration via ${state.source}`} aria-label="AI narration" />
                )}
              </p>
            ) : (
              <p className="text-sm text-muted">{prediction.insight}</p>
            )}
            <div className="flex items-center gap-2">
              <span className={`badge ${impactClass(prediction.impact)}`}>
                {prediction.impact}
              </span>
              <span style={{ flex: 1 }} />
              {!narrated && (
                <button
                  type="button"
                  data-testid={`insight-explain-${key}`}
                  disabled={state === 'loading'}
                  onClick={() => explain(prediction)}
                  style={{ textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}
                >
                  {state === 'loading' ? 'Explaining…' : 'Explain'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
