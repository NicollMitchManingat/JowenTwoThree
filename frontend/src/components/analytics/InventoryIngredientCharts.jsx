import { useEffect, useId, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
import { compareStock, formatStock, addStock } from '../../utils/formatStock'
import { chartRequestKey, ingredientChartSnapshot } from '../../services/chartFacts'
import { useChartRefreshKey, usePublishChartFacts } from './ChartFactsContext'
import SalesTrendChart from './SalesTrendChart'
import IngredientUsageComparison from './IngredientUsageComparison'
import ChartExplanation from './ChartExplanation'
import ForecastValidationPanel, { validForecastValidation } from './ForecastValidationPanel'

const number = value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
function validComparison(data) {
  const comparison = data?.comparison
  return Array.isArray(comparison?.dates) && comparison.dates.length <= 366 && comparison.dates.every(date) && new Set(comparison.dates).size === comparison.dates.length && Array.isArray(comparison.items) && comparison.items.length === data.ingredients.length &&
    comparison.items.every(row => data.ingredients.some(item => item.id === row.id && item.name === row.name && item.unit === row.unit && item.unitVersion === row.unitVersion) && Array.isArray(row.values) && row.values.length === comparison.dates.length && row.values.every(value => value === null || number(value)) && row.recordedDays === row.values.filter(value => value !== null).length && Number.isInteger(row.excludedDays) && row.excludedDays >= 0 && row.excludedDays <= comparison.dates.length - row.recordedDays &&
      (row.recordedDays ? row.total === row.values.filter(value => value !== null).reduce((sum, value) => addStock(sum, value), '0') : row.total === null))
}
function validData(data) {
  if (data?.dataQuality?.complete !== true || !Array.isArray(data.ingredients) || !Array.isArray(data.history) || !Array.isArray(data.projection) || !validComparison(data)) return false
  if (!data.ingredients.length) return data.selectedIngredientId === null && data.forecast === null && data.validation === null && data.history.length === 0 && data.projection.length === 0
  return data.ingredients.every(row => row.id && row.name && row.unit && number(row.quantity) && number(row.threshold)) &&
    data.selected?.id === data.selectedIngredientId && data.ingredients.some(row => row.id === data.selectedIngredientId && ['name', 'unit', 'unitVersion', 'quantity', 'threshold'].every(key => row[key] === data.selected[key])) &&
    data.history.every(row => date(row.date) && (row.quantity === null || number(row.quantity))) &&
    ['ready', 'insufficient_history'].includes(data.forecast?.status) && data.forecast.history?.length === 28 &&
    date(data.forecast.training?.from) && date(data.forecast.training?.through) && Number.isInteger(data.forecast.training?.observedDays) &&
    Number.isInteger(data.forecast.training?.missingDays) && data.forecast.training.observedDays + data.forecast.training.missingDays === 28 &&
    data.forecast.method?.windowDays === 28 && typeof data.projectionNotice === 'string' &&
    data.forecast.history.every(row => date(row.date) && (row.quantity === null || number(row.quantity))) &&
    Array.isArray(data.forecast.forecast) && data.forecast.forecast.every(row => date(row.date) && number(row.quantity)) &&
    (data.forecast.status === 'ready' ? data.forecast.forecast.length === 7 && number(data.forecast.total) : data.forecast.forecast.length === 0 && data.forecast.total === null) &&
    [0, 8].includes(data.projection.length) && data.projection.every(row => date(row.date) && number(row.quantity) && number(row.shortage)) &&
    validForecastValidation(data.validation, 'inventory')
}
const quantity = value => {
  if (value == null) return 'Unavailable'
  const text = formatStock(value, { maximumFractionDigits: 2 })
  return text === '0' && compareStock(value, 0) > 0 ? '<0.01' : text
}

function IngredientChart({ chartId, data, loading, error, requestKey, sourceKey, children }) {
  const snapshot = ingredientChartSnapshot(data, chartId)
  usePublishChartFacts({ ...snapshot, requestKey, sourceKey, status: error ? 'error' : loading ? 'loading' : snapshot.status })
  const chart = { labels: snapshot.series[0]?.points.map(row => row.key) || [], datasets: snapshot.series.map((series, index) => ({
    label: series.label, data: series.points.map(row => row.value), fill: false, tension: 0, spanGaps: false,
    borderColor: ['#16a34a', chartId === 'projected-stock' ? '#f59e0b' : '#2563eb'][index] || '#94a3b8',
    borderDash: index ? [5, 4] : undefined, pointRadius: 2,
  })) }
  const title = { 'ingredient-usage': 'Ingredient Usage Trend', 'ingredient-demand': 'Ingredient Demand Forecast', 'projected-stock': 'Projected Stock Balance' }[chartId]
  return <section className="card analytics-ingredient-card" data-testid={chartId + '-panel'}>
    <div className="card-header"><h3 className="m-0">{title}</h3><ChartExplanation chartId={chartId} /></div>
    <div className="card-body analytics-ingredient-body">
      {loading ? <p role="status">Loading ingredient chart...</p> : error ? <p className="text-muted">Ingredient chart is unavailable. Retry the inventory chart data above.</p>
        : !data?.selected ? <p className="text-muted">No active inventory ingredients are recorded.</p> : <>
          <p className="font-semibold">{data.selected.name} <span className="text-sm text-muted">· {data.selected.unit}</span></p>
          {chartId !== 'ingredient-usage' && data.forecast.status === 'insufficient_history' && <p role="status">Forecast unavailable: insufficient matching deduction history.</p>}
          {chartId === 'ingredient-usage' && snapshot.status === 'empty' && <p className="text-muted">No comparable sale deductions are recorded for this ingredient in the selected period.</p>}
          {chartId === 'projected-stock' && !data.projection.length && <p className="text-muted">{data.projectionNotice}</p>}
          {snapshot.series.some(series => series.points.some(point => point.value !== null)) &&
            <div className="analytics-forecast-chart"><SalesTrendChart data={chart} showSummary={false} showLegend allowZeroValues valueType="quantity" valueUnit={data.selected.unit} /></div>}
          {children}
        </>}
    </div>
  </section>
}

export default function InventoryIngredientCharts({ start, end, showForecast = true, children }) {
  const id = useId(), [ingredientId, setIngredientId] = useState(''), [result, setResult] = useState(null)
  const [error, setError] = useState(null), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0)
  const refreshKey = useChartRefreshKey(), requestKey = chartRequestKey(start, end, ingredientId, refreshKey)
  const comparisonRequestKey = chartRequestKey(start, end, refreshKey)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000)
    setLoading(true); setError(null)
    async function load() {
      try {
        const params = new URLSearchParams({ start, end, ...(ingredientId ? { ingredientId } : {}) })
        const response = await apiRequest('/api/consolidated-data/inventory/charts?' + params, { signal: controller.signal })
        if (!validData(response?.data)) throw new Error('Ingredient chart data is unavailable or incomplete. Please retry.')
        if (!cancelled) setResult({ data: response.data, sourceKey: requestKey, comparisonSourceKey: comparisonRequestKey })
      } catch (err) { if (!cancelled) setError(controller.signal.aborted ? 'Ingredient chart request timed out. Please retry.' : err.message || 'Ingredient charts are unavailable.') }
      finally { clearTimeout(timer); if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [start, end, ingredientId, retry, refreshKey, requestKey, comparisonRequestKey])
  const data = result?.data, props = { data, loading: loading || result?.sourceKey !== requestKey && !error, error, requestKey, sourceKey: result?.sourceKey }
  return <div className="inventory-ingredient-charts">
    <IngredientUsageComparison data={data} requestKey={comparisonRequestKey} sourceKey={result?.comparisonSourceKey}
      loading={result?.comparisonSourceKey !== comparisonRequestKey && !error} error={result?.comparisonSourceKey !== comparisonRequestKey ? error : null} />
    {error && <div role="alert"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={() => setRetry(n => n + 1)}>Retry ingredient charts</button></div>}
    {children}
    {showForecast && <>
    <div className="card"><div className="card-body analytics-ingredient-controls">
      <div><label htmlFor={id}>Forecast ingredient</label><select id={id} className="form-input" value={ingredientId || data?.selectedIngredientId || ''} onChange={event => setIngredientId(event.target.value)} disabled={props.loading || !!error || !data?.ingredients.length}>
        {!data?.ingredients.length && <option value="">No ingredients available</option>}{data?.ingredients.map(row => <option value={row.id} key={row.id}>{row.name} ({row.unit})</option>)}
      </select></div>
      <p className="text-sm text-muted">Choose one ingredient for the demand and stock projections below. Historical comparison selections above remain separate.</p>
      {!props.loading && !error && data?.coverage?.excludedEntries > 0 && <p role="status" className="text-sm text-muted">{data.coverage.excludedEntries} incompatible or unrecorded unit/version entries were excluded. Affected dates are left unknown.</p>}
    </div></div>

      <div className="charts-grid analytics-ingredient-forecasts">
        <IngredientChart chartId="ingredient-demand" {...props}>
          <p className="text-sm text-muted">{data?.forecast?.notice}</p>
          {data?.forecast?.status === 'ready' && <p>Seven-day estimated use: <strong>{quantity(data.forecast.total)} {data.selected.unit}</strong>.</p>}
          {data?.forecast?.training && <p className="text-sm text-muted">History: {data.forecast.training.from} to {data.forecast.training.through} · {data.forecast.training.observedDays}/28 days recorded. Same-weekday moving average; missing days are not filled with zero.</p>}
        </IngredientChart>
        <IngredientChart chartId="projected-stock" {...props}>
          <p className="text-sm">Current balance: <strong>{quantity(data?.selected?.quantity)} {data?.selected?.unit}</strong> · Low-stock threshold: {quantity(data?.selected?.threshold)} {data?.selected?.unit}.</p>
          {data?.projection?.length > 0 && <><p className="text-sm text-muted">{data.projectionNotice}</p>
            <p>{data.thresholdDate ? `Projected to reach or fall below the threshold: ${data.thresholdDate}.` : 'No threshold crossing is projected in these seven days.'}</p>
            <p>Estimated usage exceeding stock: {quantity(data.projection.at(-1).shortage)} {data.selected.unit}.</p></>}
          <p className="text-sm text-muted">Balance prediction error is unavailable without comparable historical stock snapshots. The check below evaluates usage estimates only.</p>
        </IngredientChart>
      </div>
      {!props.loading && !error && data?.validation && <ForecastValidationPanel metric="inventory" unit={data.selected.unit} result={data.validation} />}
    </>}
  </div>
}
