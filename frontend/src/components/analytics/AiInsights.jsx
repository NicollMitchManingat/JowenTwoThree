import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Package,
  ShieldAlert,
  Sparkles,
  Tag,
  TrendingUp,
  Undo2,
  Users,
  X,
} from 'lucide-react'

// Same-origin by default so the Vercel `/api` rewrite reaches the backend.
// Set VITE_API_URL=http://localhost:3001 for local `vite dev` without a proxy.
const EXPLAIN_API_BASE = import.meta.env.VITE_API_URL || ""

// Actionable insights get "Resolve now" (deep-link + dismiss).
// Non-actionable ones (forecast, staffing, anomaly-hours, all-clear) get Dismiss only.
export const RESOLVE_TARGETS = {
  reorder: 'inventory',
  wastage: 'inventory',
  promo: 'settings',
  'anomaly-refunds': 'orders',
  'anomaly-discounts': 'settings',
}

export function isResolvable(key) {
  return Object.prototype.hasOwnProperty.call(RESOLVE_TARGETS, key)
}

function impactClass(impact) {
  if (impact === 'High' || impact === 'Reorder') return 'badge-danger'
  if (impact === 'Positive') return 'badge-success'
  return 'badge-warning'
}

function impactTone(impact) {
  if (impact === 'High' || impact === 'Reorder') return 'danger'
  if (impact === 'Positive') return 'success'
  return 'warning'
}

const ICON_BY_KEY = {
  forecast: TrendingUp,
  staffing: Users,
  reorder: Package,
  wastage: AlertTriangle,
  promo: Tag,
  'all-clear': CheckCircle2,
}

function iconFor(key) {
  if (ICON_BY_KEY[key]) return ICON_BY_KEY[key]
  if (typeof key === 'string' && key.indexOf('anomaly-') === 0) return ShieldAlert
  return Sparkles
}

function templateSentence(prediction) {
  const value = prediction?.value || ''
  const finding = prediction?.insight || ''
  return `${value} — ${finding}`.replace(/^ — | — $/g, '').trim()
}

export default function AiInsights({ insights, loading = false, error = null, onRetry, onResolve }) {
  // Hooks first (no early returns before hooks) so loading → content
  // transitions keep hook order stable.
  // Per-card narration: key → 'loading' | { text, source }.
  // Any failure falls back to the template sentence locally — staff see
  // plainer wording, never an error.
  const [explained, setExplained] = useState({})
  // Session-only dismiss: resets whenever fresh insights arrive.
  const [dismissed, setDismissed] = useState({})

  useEffect(() => {
    setDismissed({})
  }, [insights])

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

  const dismiss = (key) => {
    setDismissed((prev) => ({ ...prev, [key]: true }))
  }

  const undoDismiss = () => {
    setDismissed({})
  }

  const resolve = (prediction) => {
    const key = prediction.key || prediction.metric
    setDismissed((prev) => ({ ...prev, [key]: true }))
    if (onResolve) onResolve(key, prediction)
  }

  if (loading) {
    return (
      <div data-testid="insights-loading">
        <div className="prediction-grid insights-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card prediction-card insight-card insight-card--loading">
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
      <div data-testid="insights-error" className="insights-error">
        <p className="text-sm text-muted insights-error-text">
          {typeof error === 'string' ? error : error?.message || 'Failed to load insights.'}{' '}
          {onRetry && (
            <button
              data-testid="insights-retry"
              type="button"
              className="insight-btn insight-btn--retry"
              onClick={onRetry}
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

  const visible = insights.filter((p) => !dismissed[p.key || p.metric])
  const dismissedCount = insights.length - visible.length

  if (visible.length === 0) {
    return (
      <div className="insights-handled" data-testid="insights-handled">
        <CheckCircle2 size={18} className="text-primary" aria-hidden="true" />
        <p className="text-sm text-muted">All insights handled for this period.</p>
        <button type="button" className="insight-btn" data-testid="insights-undo" onClick={undoDismiss}>
          <Undo2 size={14} aria-hidden="true" /> Undo
        </button>
      </div>
    )
  }

  return (
    <div>
      {dismissedCount > 0 && (
        <div className="insights-dismissed-bar" data-testid="insights-dismissed-bar">
          <span className="text-sm text-muted">
            {dismissedCount} dismissed
          </span>
          <button type="button" className="insight-btn" data-testid="insights-undo" onClick={undoDismiss}>
            <Undo2 size={14} aria-hidden="true" /> Undo
          </button>
        </div>
      )}
      <div className="prediction-grid insights-grid">
        {visible.map((prediction) => {
          const key = prediction.key || prediction.metric
          const state = explained[key]
          const narrated = state && state !== 'loading' ? state.text : null
          const tone = impactTone(prediction.impact)
          const Icon = iconFor(key)
          const resolvable = isResolvable(key)
          return (
            <div
              key={key}
              className={`card prediction-card insight-card insight-card--${tone}`}
              data-testid={`insight-${key}`}
            >
              <div className="insight-header">
                <span className={`insight-icon insight-icon--${tone}`} aria-hidden="true">
                  <Icon size={17} />
                </span>
                <span className="insight-title">{prediction.metric}</span>
                <button
                  type="button"
                  className="insight-dismiss"
                  data-testid={`insight-dismiss-${key}`}
                  aria-label={`Dismiss ${prediction.metric} insight`}
                  title="Dismiss"
                  onClick={() => dismiss(key)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
              <p className="insight-value">{prediction.value}</p>
              {narrated ? (
                <p className="text-sm text-muted insight-text" data-testid={`insight-explained-${key}`}>
                  {narrated}{' '}
                  {state.source && state.source !== 'template' && (
                    <Sparkles size={12} className="text-primary" title={`AI narration via ${state.source}`} aria-label="AI narration" />
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted insight-text">{prediction.insight}</p>
              )}
              <div className="insight-footer">
                <span className={`badge ${impactClass(prediction.impact)}`}>
                  {prediction.impact}
                </span>
                <span className="insight-actions">
                  {!narrated && (
                    <button
                      type="button"
                      className="insight-btn"
                      data-testid={`insight-explain-${key}`}
                      disabled={state === 'loading'}
                      onClick={() => explain(prediction)}
                    >
                      {state === 'loading' ? 'Explaining…' : 'Explain'}
                    </button>
                  )}
                  {resolvable ? (
                    <button
                      type="button"
                      className="btn btn-primary insight-resolve"
                      data-testid={`insight-resolve-${key}`}
                      onClick={() => resolve(prediction)}
                    >
                      Resolve now <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="insight-btn"
                      data-testid={`insight-dismiss-btn-${key}`}
                      onClick={() => dismiss(key)}
                    >
                      Dismiss
                    </button>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
