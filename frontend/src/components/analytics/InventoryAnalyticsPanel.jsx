import { useEffect, useState } from 'react'
import { apiRequest } from '../../services/apiClient'
import { compareStock, formatStock } from '../../utils/formatStock'

const PAGE_SIZE = 15
function quantity(value) {
  if (value == null) return '\u2014'
  const formatted = formatStock(value, { maximumFractionDigits: 2 })
  return formatted === '0' && compareStock(value, 0) > 0 ? '<0.01' : formatted
}
function Pages({ page, count, onChange, label }) {
  const last = Math.max(0, Math.ceil(count / PAGE_SIZE) - 1)
  if (!last) return null
  return <nav className="inventory-analytics-pages" aria-label={`${label} pages`}>
    <button type="button" className="btn btn-secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>Previous {label.toLowerCase()}</button>
    <span>Page {page + 1} of {last + 1}</span>
    <button type="button" className="btn btn-secondary" disabled={page === last} onClick={() => onChange(page + 1)}>Next {label.toLowerCase()}</button>
  </nav>
}

export default function InventoryAnalyticsPanel({ start, end }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [retry, setRetry] = useState(0)
  const [usagePage, setUsagePage] = useState(0)
  const [wastePage, setWastePage] = useState(0)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    setData(null); setError(null); setUsagePage(0); setWastePage(0)
    async function load() {
      try {
        const params = new URLSearchParams({ start, end })
        const response = await apiRequest(`/api/consolidated-data/inventory?${params}`, { signal: controller.signal })
        const result = response?.data
        if (result?.dataQuality?.complete !== true || !Array.isArray(result.planning) || !Array.isArray(result.wastage) || !result.usageWindow) {
          throw new Error('Inventory analytics is unavailable or incomplete. Please retry.')
        }
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(controller.signal.aborted ? 'Inventory analytics request timed out. Please retry.' : err.message || 'Inventory analytics is unavailable.')
      } finally { clearTimeout(timer) }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [start, end, retry])

  return <div className="inventory-analytics" data-testid="inventory-analytics">
    {!data ? <div className="card"><div className="card-body">
      {error ? <div role="alert"><p>{error}</p><button className="btn btn-secondary" type="button" onClick={() => setRetry(value => value + 1)}>Retry inventory analytics</button></div>
        : <p role="status">Loading inventory usage and wastage...</p>}
    </div></div> : <>
      <div className="card">
        <div className="card-header"><h3 className="m-0">Recorded Wastage</h3></div>
        <div className="card-body inventory-analytics-notes">
          <p className="text-sm text-muted">Follows the selected period. Totals stay separate for each ingredient, recorded unit and unit version. Unrecorded units show entry counts only.</p>
          {data.dataQuality.unknownUnitWastageEntries > 0 && <p role="status">{data.dataQuality.unknownUnitWastageEntries} wastage entries have unrecorded units; their quantities cannot be safely combined.</p>}
        </div>
        {data.wastage.length ? <table className="inventory-analytics-table" aria-label="Recorded wastage by ingredient and unit">
          <colgroup>{[25, 20, 15, 10, 30].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup>
          <thead><tr><th scope="col">Ingredient</th><th scope="col">Recorded unit</th><th scope="col" className="analytics-number">Quantity</th><th scope="col" className="analytics-number">Entries</th><th scope="col">Details</th></tr></thead>
          <tbody>{data.wastage.slice(wastePage * PAGE_SIZE, (wastePage + 1) * PAGE_SIZE).map(row => <tr key={row.id}>
            <td>{row.name}{row.active === false && <small className="text-muted inventory-analytics-detail">Archived ingredient</small>}</td>
            <td>{row.unit || 'Unrecorded'}{row.unitVersion != null && <small className="text-muted inventory-analytics-detail">Version {row.unitVersion}</small>}</td>
            <td className="analytics-number" title={row.quantity || ''}>{quantity(row.quantity)}</td><td className="analytics-number">{row.entries}</td>
            <td>{row.reasons.join(', ')}<small className="text-muted inventory-analytics-detail">{row.unit === null ? 'Quantity not comparable' : row.currentUnit ? 'Matches current unit/version' : 'Earlier unit/version; kept separate'}</small></td>
          </tr>)}</tbody>
        </table> : <p className="card-body text-muted">No wastage recorded for this period.</p>}
        <Pages page={wastePage} count={data.wastage.length} onChange={setWastePage} label="Wastage" />
      </div>
      <div className="card">
        <div className="card-header"><h3 className="m-0">Ingredient Usage &amp; Stock Cover</h3></div>
        <div className="card-body inventory-analytics-notes">
          <p>Current quantities with sales from {data.usageWindow.from} to {data.usageWindow.through}: {data.usageWindow.recordedSalesDays} recorded sales days.</p>
          <p className="text-sm text-muted">Current recipe estimate, not exact historical consumption. Daily usage averages recorded sales days only; missing days are unknown. The seven-day scenario assumes that rate repeats each day. Purchases, deliveries and future adjustments are not included.</p>
          <p className="text-sm text-muted">Validation limit: this is a current-recipe scenario, not a backtested forecast. Complete historical recipe and stock snapshots are unavailable, so no accuracy score or confidence percentage is assigned.</p>
          {data.dataQuality.unmappedLines > 0 && <p role="status">Some sale lines cannot be linked to products. Usage estimates are withheld until those records are reviewed.</p>}
        </div>
        <table className="inventory-analytics-table" aria-label="Ingredient usage estimates">
          <colgroup>{[17, 10, 7, 12, 10, 12, 10, 22].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup>
          <thead><tr>{['Ingredient', 'Quantity', 'Unit', 'Daily usage', 'Days of cover', '7-day usage', 'Shortage', 'Recommendation'].map((label, i) => <th key={label} scope="col" className={i > 0 && i < 7 && i !== 2 ? 'analytics-number' : ''}>{label}</th>)}</tr></thead>
          <tbody>{data.planning.slice(usagePage * PAGE_SIZE, (usagePage + 1) * PAGE_SIZE).map(row => <tr key={row.id}>
            <td>{row.name}</td><td className="analytics-number" title={row.quantity}>{quantity(row.quantity)}</td><td>{row.unit}</td>
            <td className="analytics-number" title={row.dailyUsage || ''}>{quantity(row.dailyUsage)}</td>
            <td className="analytics-number" title={row.daysCover || ''}>{quantity(row.daysCover)}</td>
            <td className="analytics-number" title={row.sevenDayUsage || ''}>{quantity(row.sevenDayUsage)}</td>
            <td className="analytics-number" title={row.shortage || ''}>{quantity(row.shortage)}</td>
            <td>{row.recommendation}<small className="text-muted inventory-analytics-detail">{row.status === 'estimated' ? 'Current recipe estimate' : row.status === 'no_recorded_usage' ? 'No recorded usage' : row.status === 'no_sales' ? 'No recorded sales days' : 'Estimate unavailable'}</small></td>
          </tr>)}</tbody>
        </table>
        {!data.planning.length && <p className="card-body text-muted">No active ingredients recorded.</p>}
        <Pages page={usagePage} count={data.planning.length} onChange={setUsagePage} label="Usage" />
      </div>
    </>}
  </div>
}
