// Read-only analytics bounds. No browser grants or business writers are changed.
const DAY_MS = 86400000
const MANILA_OFFSET_MS = 8 * 3600000

function manilaDate(value) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time + MANILA_OFFSET_MS) : null
}
function dayKey(value) { return manilaDate(value)?.toISOString().slice(0, 10) || null }
function hourOf(value) { return manilaDate(value)?.getUTCHours() ?? null }
function dayStart(value) {
  const key = dayKey(value)
  return key ? new Date(`${key}T00:00:00+08:00`) : null
}
function calendarStart(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00+08:00`)
  return dayKey(date) === value ? date : null
}

async function readAll(build, { maxRows = 20000, pageSize = 1000, label = 'Analytics' } = {}) {
  const rows = []
  const check = result => {
    if (result.error || !Array.isArray(result.data)) throw Object.assign(new Error(label + ' data is unavailable. Please retry.'), { statusCode: 503 })
    return result.data
  }
  let width = Math.min(pageSize, maxRows + 1)
  // Establish the effective server page size, then fetch at most four pages
  // concurrently. Short nonempty pages still require an EOF probe.
  let batch = [check(await build(0, width - 1))]
  for (;;) {
    for (const page of batch) {
      if (!page.length) return rows
      rows.push(...page)
      if (rows.length > maxRows) throw Object.assign(new Error(label + ' exceeds the safe reporting limit. Select a shorter period.'), { statusCode: 503 })
      if (page.length < width) { width = page.length; break }
    }
    // If a server shrinks a page, discard speculative later pages and restart
    // from the actual received offset, so a reduced cap cannot skip records.
    const count = Math.min(4, Math.ceil((maxRows - rows.length + 1) / width))
    batch = (await Promise.all(Array.from({ length: count }, (_, i) => {
      const start = rows.length + i * width
      return build(start, start + Math.min(width, maxRows - start + 1) - 1)
    }))).map(check)
  }
}

module.exports = { DAY_MS, dayKey, hourOf, dayStart, calendarStart, readAll }
