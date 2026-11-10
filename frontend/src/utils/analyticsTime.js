// The restaurant reports in Asia/Manila, independently of the staff device zone.
export const DAY_MS = 86400000
const OFFSET_MS = 8 * 3600000
export function manilaClock(value = new Date()) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time + OFFSET_MS) : null
}
export function manilaDay(value = new Date()) { return manilaClock(value)?.toISOString().slice(0, 10) || null }
export function manilaHour(value) { return manilaClock(value)?.getUTCHours() ?? null }
export function manilaStart(day = manilaDay()) { return new Date(`${day}T00:00:00+08:00`) }
export function manilaEnd(day = manilaDay()) { return new Date(manilaStart(day).getTime() + DAY_MS - 1) }
