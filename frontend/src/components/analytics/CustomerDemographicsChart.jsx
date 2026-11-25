import { useEffect, useState } from 'react'
import { db } from '../../services/db'
import { demographicTotals } from '../../services/salesAnalytics'
import { useChartRefreshKey } from './ChartFactsContext'
import { chartRequestKey } from '../../services/chartFacts'
import BreakdownChart from './BreakdownChart'

export default function CustomerDemographicsChart({ start, end }) {
  const [result, setResult] = useState(null), [error, setError] = useState(null), [retry, setRetry] = useState(0)
  const refreshKey = useChartRefreshKey(), requestKey = chartRequestKey(start, end, refreshKey)
  useEffect(() => {
    let cancelled = false
    setResult(null); setError(null)
    Promise.resolve().then(() => db.getHourlyTraffic(start, end)).then(rows => {
      if (!Array.isArray(rows)) throw new Error('Customer demographic data is incomplete.')
      const totals = demographicTotals(rows)
      if (!cancelled) setResult({ totals, sourceKey: requestKey })
    }).catch(err => { if (!cancelled) setError(err.message || 'Customer demographics are unavailable.') })
    return () => { cancelled = true }
  }, [start, end, retry, refreshKey, requestKey])
  const rows = [{ key: 'male', label: 'Male', count: result?.totals.male || 0, color: '#3b82f6' },
    { key: 'female', label: 'Female', count: result?.totals.female || 0, color: '#a855f7' },
    { key: 'unspecified', label: 'Unspecified', count: result?.totals.unspecified || 0, color: '#94a3b8' }]
  return <>
    {error && <div role="alert"><p>{error}</p><button type="button" className="btn btn-secondary" onClick={() => setRetry(n => n + 1)}>Retry demographics</button></div>}
    <BreakdownChart chartId="traffic-demographics" rows={rows} scope={{ start, end }} status={error ? 'error' : result ? 'ready' : 'loading'}
      requestKey={requestKey} sourceKey={result?.sourceKey} coverage={{ source: 'customer_traffic', recordingCoverage: 'unknown' }}
      limitations={['Recorded visits, not verified unique customers. Unclassified counts remain Unspecified; demographic splits are not inferred.']} />
  </>
}
