import { useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest } from '../../services/apiClient'

const PAGE_SIZE = 15
const bases = ['Planning', 'All', 'Recorded', 'Current balance', 'Prediction', 'Scenario', 'Historical check', 'Advisory', 'Limitation']
const nonnegative = value => Number.isFinite(value) && value >= 0
const whole = value => Number.isInteger(value) && value >= 0
const validReport = data => data?.schemaVersion === 1 && data.dataQuality?.complete === true &&
  Number.isFinite(new Date(data.generatedAt).getTime()) && data.period && data.summary &&
  ['ready', 'insufficient_history'].includes(data.summary.salesStatus) && ['ready', 'insufficient_history'].includes(data.summary.trafficStatus) &&
  (data.summary.salesStatus === 'ready' ? nonnegative(data.summary.salesTotal) : data.summary.salesTotal === null) &&
  (data.summary.trafficStatus === 'ready' ? whole(data.summary.trafficTotal) : data.summary.trafficTotal === null) &&
  whole(data.summary.inventoryItems) && whole(data.summary.salesScoredDays) && whole(data.summary.trafficScoredDays) &&
  Array.isArray(data.notes) && data.notes.every(note => typeof note === 'string') &&
  Array.isArray(data.rows) && data.rows.length > 0 && data.rows.every(row => typeof row.section === 'string' && typeof row.basis === 'string' && typeof row.metric === 'string' &&
    (row.value == null || typeof row.value === 'string' || (typeof row.value === 'number' && Number.isFinite(row.value)))) &&
  /^predictive-report-\d{4}-\d{2}-\d{2}\.csv$/.test(data.export?.filename || '') && typeof data.export.csv === 'string' && data.export.csv.length > 0

function displayValue(row) {
  if (row.value == null) return 'Not available'
  // Decimal strings retain every source digit in the report/export.
  const value = typeof row.value === 'number' ? row.value.toLocaleString('en-PH', { maximumFractionDigits: 2 }) : row.value
  return value + (row.unit ? ' ' + row.unit : '')
}
const displayStatus = status => {
  const label = String(status || 'Recorded').replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function PredictiveReportPanel({ start, end }) {
  const key = JSON.stringify([start, end])
  const [loaded, setLoaded] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0), [section, setSection] = useState('Sales'), [basis, setBasis] = useState('Planning'), [page, setPage] = useState(0)
  const [exportError, setExportError] = useState(null)
  const exporting = useRef(false)
  const data = loaded?.key === key ? loaded.data : null
  useEffect(() => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000)
    let cancelled = false
    setLoaded(null); setError(null); setExportError(null); setLoading(true); setPage(0)
    async function load() {
      try {
        const params = new URLSearchParams()
        if (start) params.set('start', start)
        if (end) params.set('end', end)
        const result = await apiRequest('/api/consolidated-data/predictive?' + params, { signal: controller.signal })
        if (!validReport(result?.data)) throw new Error('Predictive report is unavailable or incomplete. Please retry.')
        if (!cancelled) setLoaded({ key, data: result.data })
      } catch (err) {
        if (!cancelled) setError(controller.signal.aborted ? 'Predictive report request timed out. Please retry.' : err.message || 'Predictive report is unavailable.')
      } finally { clearTimeout(timer); if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [key, start, end, retry])
  const rows = useMemo(() => (data?.rows || []).filter(row => row.section !== 'Report' &&
    (section === 'All' || row.section === section) && (basis === 'All' || (basis === 'Planning' ? ['Prediction', 'Scenario', 'Advisory'].includes(row.basis) : row.basis === basis))), [data, section, basis])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), currentPage = Math.min(page, pages - 1)
  function download() {
    if (!data || loading || error || exporting.current) return
    exporting.current = true
    setExportError(null)
    let url, anchor
    try {
      url = URL.createObjectURL(new Blob([data.export.csv], { type: 'text/csv;charset=utf-8' }))
      anchor = document.createElement('a'); anchor.href = url; anchor.download = data.export.filename
      document.body.appendChild(anchor); anchor.click()
    } catch { setExportError('Predictive CSV export failed. Please try again.') }
    finally {
      anchor?.remove()
      if (url) URL.revokeObjectURL(url)
      exporting.current = false
    }
  }
  return <div className="card predictive-report-card" data-testid="predictive-report">
    <div className="card-header"><h3 className="m-0">Predictive Business Report</h3>
      <button type="button" className="btn btn-primary" disabled={!data || loading || !!error} onClick={download}>Export full predictive CSV</button></div>
    <div className="card-body">
      {loading || (!data && !error) ? <p role="status">Loading predictive report...</p> : error ? <div role="alert"><p>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={() => setRetry(value => value + 1)}>Retry predictive report</button></div> : data && <>
        <p className="text-sm">Generated {new Date(data.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila). Forecast training through {data.forecastThrough}.</p>
        <div className="predictive-report-summary">
          <p><strong>Sales forecast</strong><span>{data.summary.salesStatus === 'ready' ? data.summary.salesTotal.toLocaleString('en-PH') + ' PHP / next 7 days' : 'Insufficient history'}</span></p>
          <p><strong>Customer forecast</strong><span>{data.summary.trafficStatus === 'ready' ? data.summary.trafficTotal.toLocaleString('en-PH') + ' customers / next 7 days' : 'Insufficient history'}</span></p>
          <p><strong>Inventory planning</strong><span>{data.summary.inventoryItems} current ingredients</span></p>
        </div>
        <p className="text-sm text-muted">Current balances, recorded results, predictions and scenarios are labelled separately. Historical checks scored {data.summary.salesScoredDays} sales days and {data.summary.trafficScoredDays} traffic days; these revised-record comparisons do not prove future accuracy.</p>
        <details className="predictive-report-notes"><summary>Methods, recording coverage and limitations</summary><ul>{data.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>
        <div className="predictive-report-filters">
          <label>Aspect<select className="form-input" value={section} onChange={event => { setSection(event.target.value); setPage(0) }}>
            {['Sales', 'Inventory', 'Customer Traffic', 'All'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Data basis<select className="form-input" value={basis} onChange={event => { setBasis(event.target.value); setPage(0) }}>
            {bases.map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <p className="text-sm text-muted">Preview filters change the table only. CSV includes all sections from this loaded report, with exact source decimals and all methods, dates and limitations.</p>
        <table className="data-table predictive-report-table" aria-label="Predictive business report preview">
          <colgroup><col style={{ width: '30%' }} /><col style={{ width: '28%' }} /><col style={{ width: '18%' }} /><col style={{ width: '24%' }} /></colgroup>
          <thead><tr><th>Metric / method</th><th>Date / item</th><th>Value / unit</th><th>Basis / status</th></tr></thead>
          <tbody>{rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((row, index) => <tr key={currentPage * PAGE_SIZE + index}>
            <td><strong>{row.metric}</strong><small>{row.method}</small><details><summary>Details</summary><p>{row.note || 'No additional notes.'}</p>
              {row.trainingFrom && <p>Training: {row.trainingFrom} to {row.trainingThrough}. Recorded days: {row.observedDays ?? 'Unknown'}.</p>}</details></td>
            <td>{row.date || 'Current scenario'}{row.through && <> to {row.through}</>}{row.hour !== undefined && <small>{String(row.hour).padStart(2, '0')}:00 (Manila)</small>}
              {row.item && <small>{row.item}{row.unitVersion != null && <> · unit version {row.unitVersion}</>}</small>}</td>
            <td>{displayValue(row)}</td><td>{row.basis}<small>{displayStatus(row.status)}</small></td>
          </tr>)}{rows.length === 0 && <tr><td colSpan={4}>No rows match this preview filter.</td></tr>}</tbody>
        </table>
        <div className="predictive-report-pagination"><span>{rows.length} rows · page {currentPage + 1} of {pages}</span>
          <button type="button" className="btn btn-secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous report page</button>
          <button type="button" className="btn btn-secondary" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next report page</button></div>
      </>}
      {exportError && <p role="alert">{exportError}</p>}
    </div>
  </div>
}
