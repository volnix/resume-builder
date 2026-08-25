/**
 * Scope-line generation. The scope line is the italic line under a job title —
 * the first thing a hiring manager scans — so it is generated from structured
 * inputs rather than free text, and stays consistent across roles.
 */
import { IC_FOCUS_MAX, type Position } from '../types'

const SEP = ' · '

/** Plural unless the count is exactly 1 ("20+" and "" read as plural). */
const noun = (count: string, singular: string): string =>
  `${count} ${/^0*1$/.test(count.trim()) ? singular : `${singular}s`}`

/**
 * Manager: "24 engineers · 4 direct reports".
 * IC: the chosen focus areas, "Back-end Engineering · Team Lead".
 */
export function generateScopeLine(p: Position): string {
  if (p.track === 'manager') {
    const parts: string[] = []
    const team = p.teamSize.trim()
    const reports = p.directReports.trim()
    if (team) parts.push(noun(team, 'engineer'))
    if (reports) parts.push(noun(reports, 'direct report'))
    return parts.join(SEP)
  }
  return p.focus.slice(0, IC_FOCUS_MAX).join(SEP)
}

/** What actually renders: a manual scope line wins, otherwise the generated one. */
export const effectiveScope = (p: Position): string => p.scope.trim() || generateScopeLine(p)

/** Toggle one focus area, refusing additions past IC_FOCUS_MAX. */
export function toggleFocus<T extends string>(current: T[], value: T): T[] {
  if (current.includes(value)) return current.filter((f) => f !== value)
  if (current.length >= IC_FOCUS_MAX) return current
  return [...current, value]
}
