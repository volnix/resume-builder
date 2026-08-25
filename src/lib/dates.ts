/**
 * Date helpers shared by the LinkedIn importer and the tenure calculator.
 * Resume dates are human strings ("Jan 2020", "2019", "Present"), never Date
 * objects — they are typed by hand and rendered verbatim.
 */
import type { Position } from '../types'

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** A role with no end date, or one marked Present, is still held. */
export const isPresent = (value: string): boolean => {
  const v = value.trim()
  return !v || /^(present|current|now|ongoing)$/i.test(v)
}

/**
 * Absolute month index (year * 12 + month) for comparison and arithmetic.
 * `bareYearMonth` decides how a year-only value resolves: 0 (January) for a
 * start date, 11 (December) for an end date.
 */
export function monthKey(value: string, bareYearMonth = 0): number | null {
  const v = value.trim()
  if (!v) return null

  const named = v.match(/^([A-Za-z]{3,9})\.?\s+(\d{4})$/)
  if (named) {
    const idx = MONTHS.findIndex((m) => named[1].toLowerCase().startsWith(m.toLowerCase()))
    if (idx >= 0) return Number(named[2]) * 12 + idx
  }

  const iso = v.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  if (iso) {
    const month = Number(iso[2]) - 1
    if (month >= 0 && month <= 11) return Number(iso[1]) * 12 + month
  }

  const year = v.match(/^(\d{4})$/)
  if (year) return Number(year[1]) * 12 + bareYearMonth

  return null
}

const monthKeyOf = (date: Date): number => date.getFullYear() * 12 + date.getMonth()

/** "8 yrs 6 mos", "1 yr", "5 mos". Empty for a non-positive span. */
export function formatDuration(months: number): string {
  if (!Number.isFinite(months) || months < 1) return ''
  const years = Math.floor(months / 12)
  const rest = months % 12
  const parts: string[] = []
  if (years) parts.push(`${years} ${years === 1 ? 'yr' : 'yrs'}`)
  if (rest) parts.push(`${rest} ${rest === 1 ? 'mo' : 'mos'}`)
  return parts.join(' ')
}

export interface Tenure {
  /** "Jan 2017 – Present" */
  range: string
  /** "8 yrs 6 mos" — empty when the dates can't be parsed. */
  duration: string
  /** Both joined for display: "Jan 2017 – Present · 8 yrs 6 mos". */
  label: string
}

/**
 * Derives one tenure spanning every position held at a company: earliest start
 * to latest end, inclusive of both months (so Jan–Dec is 12 months, matching how
 * LinkedIn counts). A single position still held reads as "Present".
 */
export function companyTenure(positions: Position[], now: Date = new Date()): Tenure {
  const empty: Tenure = { range: '', duration: '', label: '' }

  let startKey: number | null = null
  let startText = ''
  let endKey: number | null = null
  let endText = ''
  let current = false

  for (const p of positions) {
    const key = monthKey(p.startDate, 0)
    if (key !== null && (startKey === null || key < startKey)) {
      startKey = key
      startText = p.startDate.trim()
    }

    if (isPresent(p.endDate)) {
      // Only counts as current if we know when the role began.
      if (key !== null) current = true
      continue
    }
    const ended = monthKey(p.endDate, 11)
    if (ended !== null && (endKey === null || ended > endKey)) {
      endKey = ended
      endText = p.endDate.trim()
    }
  }

  if (startKey === null) return empty

  const finishKey = current ? monthKeyOf(now) : endKey
  const finishText = current ? 'Present' : endText
  if (finishKey === null) return { range: startText, duration: '', label: startText }

  const range = `${startText} – ${finishText}`
  const duration = formatDuration(finishKey - startKey + 1)
  return { range, duration, label: duration ? `${range} · ${duration}` : range }
}
