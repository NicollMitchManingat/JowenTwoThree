import { useId, useState } from 'react'
import { X, Layers3 } from 'lucide-react'
import { usageComparisonSnapshot, usageUnitLabel } from '../../services/chartFacts'
import { formatStock, compareStock } from '../../utils/formatStock'
import { usePublishChartFacts } from './ChartFactsContext'
import ChartExplanation from './ChartExplanation'
import SalesTrendChart from './SalesTrendChart'

const quantity = value => {
  if (value === null) return 'Unavailable'
  const text = formatStock(value, { maximumFractionDigits: 2 })
  return text === '0' && compareStock(value, 0) > 0 ? '<0.01' : text.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function IngredientUsageComparison({ data, loading, error, requestKey, sourceKey }) {
  const id = useId(), [unit, setUnit] = useState(null), [selections, setSelections] = useState({})
  const comparison = data?.comparison
  const defaults = usageComparisonSnapshot(comparison)
  const units = [...new Set((comparison?.items || []).map(row => row.unit))]
  const activeUnit = units.includes(unit) ? unit : defaults.view.comparisonUnit
  const chosen = selections[activeUnit]?.filter(id => comparison?.items.some(row => row.id === id && row.unit === activeUnit))
  const snapshot = usageComparisonSnapshot(comparison, { comparisonUnit: activeUnit, ...(chosen === undefined ? {} : { ingredientIds: chosen }) })
  usePublishChartFacts({ ...snapshot, requestKey, sourceKey, status: error ? 'error' : loading ? 'loading' : snapshot.status })
  const available = (comparison?.items || []).filter(row => row.unit === activeUnit && !snapshot.view.ingredientIds.includes(row.id)).sort((a, b) => a.name.localeCompare(b.name))
  const select = ids => setSelections(previous => ({ ...previous, [activeUnit]: ids }))
  const chart = { labels: snapshot.series[0]?.points.map(row => row.key) || [], datasets: snapshot.series.map((series, index) => ({
    label: series.label, data: series.points.map(point => point.value), borderColor: series.color, backgroundColor: series.color,
    borderWidth: 2.5, pointRadius: 2, pointHoverRadius: 5, pointStyle: ['circle', 'rect', 'triangle', 'rectRot', 'crossRot'][index],
    tension: .15, fill: false, spanGaps: false,
  })) }
  return <section className="card analytics-usage-card" data-testid="ingredient-usage-panel">
    <div className="card-header"><div><h3 className="m-0">Ingredient Usage Trend</h3><p className="text-sm text-muted">Compare recorded consumption across ingredients</p></div><ChartExplanation chartId="ingredient-usage" /></div>
    <div className="card-body analytics-usage-body">
      {loading ? <p role="status">Loading ingredient comparisons...</p> : error ? <p className="text-muted">Ingredient comparisons are unavailable. Retry the ingredient chart data below.</p> : !units.length ? <p className="text-muted">No active inventory ingredients are recorded.</p> : <>
        <div className="analytics-usage-toolbar">
          <div className="analytics-usage-units" role="group" aria-label="Usage measurement unit">{[...units].sort((a, b) => ({ g: 0, mL: 1, pcs: 2 }[a] ?? 3) - ({ g: 0, mL: 1, pcs: 2 }[b] ?? 3) || a.localeCompare(b)).map(value =>
            <button type="button" key={value} aria-label={`${usageUnitLabel(value)} ${value}`} aria-pressed={activeUnit === value} onClick={() => setUnit(value)}>{usageUnitLabel(value)}<span>{value}</span></button>)}</div>
          <span className="analytics-usage-count"><Layers3 size={15} aria-hidden="true" />{snapshot.rows.length} of 5 ingredients</span>
        </div>
        <div className="analytics-usage-selection">
          <div className="analytics-usage-chips">{snapshot.rows.map((row, index) => <button type="button" key={row.id} onClick={() => select(snapshot.view.ingredientIds.filter(id => id !== row.id))} aria-label={`Remove ${row.name} from comparison`}>
            <span style={{ backgroundColor: snapshot.series[index].color }} />{row.name}<X size={14} aria-hidden="true" /></button>)}</div>
          <div className="analytics-usage-add"><label htmlFor={id}>Add ingredient</label><select id={id} className="form-input" value="" disabled={snapshot.rows.length >= 5 || !available.length} onChange={event => { if (event.target.value) select([...snapshot.view.ingredientIds, event.target.value]) }}>
            <option value="">{snapshot.rows.length >= 5 ? 'Five ingredients selected' : 'Choose an ingredient'}</option>{available.map(row => <option key={row.id} value={row.id}>{row.name}{row.recordedDays ? '' : ' (no comparable records)'}</option>)}</select></div>
        </div>
        {snapshot.status === 'ready' ? <div className="analytics-usage-plot"><SalesTrendChart data={chart} showSummary={false} showLegend allowZeroValues valueType="quantity" valueUnit={activeUnit} compactDates /></div>
          : <div className="analytics-usage-empty"><Layers3 size={28} aria-hidden="true" /><p>{snapshot.rows.length ? 'No comparable sale deductions for these ingredients in the selected period.' : 'Select up to five ingredients to compare their recorded usage.'}</p></div>}
        {snapshot.rows.length > 0 && <table className="analytics-usage-summary" aria-label="Ingredient usage comparison summary">
          <colgroup><col style={{ width: '34%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /></colgroup>
          <thead><tr><th scope="col">Ingredient</th><th scope="col">Recorded usage ({activeUnit})</th><th scope="col">Avg / recorded day ({activeUnit})</th><th scope="col">Recorded days</th></tr></thead>
          <tbody>{snapshot.rows.map((row, index) => <tr key={row.id}><th scope="row"><span className="analytics-usage-dot" style={{ backgroundColor: snapshot.series[index].color }} />{row.name}</th><td title={row.total ?? undefined}>{quantity(row.total)}</td><td>{quantity(row.average)}</td><td>{row.recordedDays} / {row.periodDays}<small>{row.excludedDays > 0 ? `${row.excludedDays} unit/version gaps` : row.recordedDays < row.periodDays ? 'Incomplete coverage' : 'All selected dates recorded'}</small></td></tr>)}</tbody>
        </table>}
        <p className="text-sm text-muted analytics-usage-note">Matching sale deductions in each ingredient's current unit/version. Averages use recorded days only; gaps are unknown, not zero. Today's figures may be incomplete. Recording coverage can affect comparisons.</p>
      </>}
    </div>
  </section>
}
