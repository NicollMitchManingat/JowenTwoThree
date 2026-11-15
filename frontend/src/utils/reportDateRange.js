import { manilaDay, manilaStart, DAY_MS } from './analyticsTime'

export function validateReportRange({ from = null, to = null } = {}) {
  for (const day of [from, to]) {
    if (day && (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || manilaDay(manilaStart(day)) !== day)) {
      throw new Error('Choose valid From and To dates.')
    }
  }
  if (from && to && from > to) throw new Error('From date must not be after To date.')
  return { from: from || null, to: to || null }
}

export function presetReportRange(preset, from, to, now = new Date()) {
  if (from || to) return validateReportRange({ from, to })
  if (['today', '7d', '30d'].includes(preset)) {
    const last = manilaDay(now), days = preset === '7d' ? 6 : preset === '30d' ? 29 : 0
    return { from: manilaDay(new Date(manilaStart(last).getTime() - days * DAY_MS)), to: last }
  }
  return { from: null, to: null }
}

// Requested bounds take precedence; open/all-time exports use observed coverage.
// Missing coverage stays explicit when the report has no records.
export function reportDateRange({ from, to, dates = [] } = {}) {
  const bounds = validateReportRange({ from, to })
  const observed = dates.filter(Boolean).map(value => manilaDay(value)).filter(Boolean).sort()
  const first = bounds.from || observed[0] || null, last = bounds.to || observed.at(-1) || null
  return {
    from: first, to: last,
    label: first || last ? `${first || 'Earliest available'} to ${last || 'Latest available'} (Manila)` : 'All time — no records (Manila)',
    filenamePart: `${first || 'unbounded'}_to_${last || 'unbounded'}`,
  }
}

export function reportFilename(prefix, range, extension = 'xlsx') {
  return `${prefix}-${reportDateRange(range).filenamePart}.${extension}`
}
