import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { canonicalChartValue, createChartFacts } from '../../services/chartFacts'

const ChartFactsContext = createContext(null)
const subscribeNothing = () => () => {}
const readNothing = () => null

function createRegistry() {
  const snapshots = new Map(), listeners = new Set()
  const notify = () => listeners.forEach(listener => listener())
  return {
    read: id => snapshots.get(id) || null,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    publish: snapshot => {
      if (snapshots.get(snapshot.chartId)?.identity !== snapshot.identity) {
        snapshots.set(snapshot.chartId, snapshot); notify()
      }
      return () => {
        if (snapshots.get(snapshot.chartId) === snapshot) { snapshots.delete(snapshot.chartId); notify() }
      }
    },
  }
}

export function ChartFactsProvider({ scope = {}, children, onRefresh }) {
  const [registry] = useState(createRegistry)
  const scopeKey = canonicalChartValue(scope)
  const value = useMemo(() => ({ registry, scope: JSON.parse(scopeKey), scopeKey, onRefresh }), [registry, scopeKey, onRefresh])
  return <ChartFactsContext.Provider value={value}>{children}</ChartFactsContext.Provider>
}

export function usePublishChartFacts(input) {
  const context = useContext(ChartFactsContext)
  // Canonicalize only the aggregate/display inputs; never raw transaction rows.
  let content
  try { content = canonicalChartValue(input) } catch { content = null }
  const scopeKey = context?.scopeKey || '{}'
  const snapshot = useMemo(() => {
    if (!input.chartId || input.enabled === false) return null
    const values = content === null ? { chartId: input.chartId, status: 'error' } : JSON.parse(content)
    return createChartFacts({ ...values, scope: { ...JSON.parse(scopeKey), ...values.scope } })
  }, [content, scopeKey, input.chartId, input.enabled])
  const registry = context?.registry
  useEffect(() => {
    if (!registry || !snapshot) return
    return registry.publish(snapshot)
  }, [registry, snapshot])
  return snapshot
}

// A changed selection cannot read an old snapshot, even before fetch effects run.
export function useChartFacts(chartId) {
  const context = useContext(ChartFactsContext)
  const read = useCallback(() => {
    const snapshot = context?.registry.read(chartId)
    if (!snapshot) return null
    const matches = Object.entries(context.scope).every(([key, value]) => canonicalChartValue(snapshot.scope[key]) === canonicalChartValue(value))
    return matches ? snapshot : null
  }, [context, chartId])
  return useSyncExternalStore(context?.registry.subscribe || subscribeNothing, context ? read : readNothing, readNothing)
}

export function PublishChartFacts(props) {
  usePublishChartFacts(props)
  return null
}

export const useChartRefreshKey = () => useContext(ChartFactsContext)?.scope.refreshKey || 0
export const useRefreshCharts = () => useContext(ChartFactsContext)?.onRefresh
