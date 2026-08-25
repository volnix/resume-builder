import type { Resume } from '../types'
import { normalizeResume } from './normalize'

/**
 * The JSON backup format: every field the editor holds, with no styling and no
 * HTML, so it doubles as a plain data dump for use elsewhere. Wrapped in a small
 * envelope purely so a file found later identifies itself.
 */
export const JSON_SCHEMA_ID = 'resume-builder-data'
export const JSON_SCHEMA_VERSION = 3

export interface ResumeFile {
  schema: typeof JSON_SCHEMA_ID
  version: number
  exportedAt: string
  resume: Resume
}

/** Stable key order, so re-exports diff cleanly in version control. */
function orderedResume(r: Resume): Resume {
  return {
    theme: r.theme,
    contact: {
      name: r.contact.name,
      headline: r.contact.headline,
      email: r.contact.email,
      phone: r.contact.phone,
      location: r.contact.location,
      linkedinUrl: r.contact.linkedinUrl,
      githubUrl: r.contact.githubUrl,
      websiteUrl: r.contact.websiteUrl,
      photo: r.contact.photo,
    },
    summary: r.summary,
    companies: r.companies.map((c) => ({
      id: c.id,
      name: c.name,
      location: c.location,
      positions: c.positions.map((p) => ({
        id: p.id,
        title: p.title,
        startDate: p.startDate,
        endDate: p.endDate,
        track: p.track,
        teamSize: p.teamSize,
        directReports: p.directReports,
        focus: [...p.focus],
        scope: p.scope,
        bullets: [...p.bullets],
      })),
    })),
    education: r.education.map((e) => ({ ...e })),
    skills: r.skills.map((s) => ({ ...s })),
  }
}

export function resumeToJson(resume: Resume, exportedAt = new Date()): string {
  const file: ResumeFile = {
    schema: JSON_SCHEMA_ID,
    version: JSON_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    resume: orderedResume(resume),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export interface RestoreResult {
  resume: Resume
  notes: string[]
}

/**
 * Read a backup back in. Deliberately forgiving: it accepts the envelope this app
 * writes, a bare resume object (handy if you generated one elsewhere), and the
 * flat v1 shape, filling in anything missing. It refuses only input it cannot
 * read as a resume at all, so a mistaken file doesn't silently wipe the editor.
 */
export function parseResumeJson(text: string): RestoreResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('That JSON file does not contain a resume object.')
  }

  const notes: string[] = []
  const envelope = parsed as Partial<ResumeFile> & Record<string, unknown>
  const isEnvelope = Boolean(envelope.resume && typeof envelope.resume === 'object')
  const body = isEnvelope ? envelope.resume : parsed

  if (isEnvelope && envelope.schema && envelope.schema !== JSON_SCHEMA_ID) {
    notes.push(`File declares schema "${String(envelope.schema)}" — read as resume data anyway.`)
  }
  if (isEnvelope && typeof envelope.version === 'number' && envelope.version !== JSON_SCHEMA_VERSION) {
    notes.push(`File was written by format v${envelope.version}; this build reads v${JSON_SCHEMA_VERSION}.`)
  }

  const looksLikeResume =
    body !== null &&
    typeof body === 'object' &&
    ['contact', 'summary', 'companies', 'positions', 'education', 'skills', 'theme'].some(
      (key) => key in (body as Record<string, unknown>),
    )
  if (!looksLikeResume) throw new Error('That JSON file does not look like resume data.')

  const resume = normalizeResume(body, notes)
  const positions = resume.companies.reduce((n, c) => n + c.positions.length, 0)
  notes.unshift(
    `Restored ${resume.companies.length} ${plural(resume.companies.length, 'company', 'companies')}, ` +
      `${positions} ${plural(positions, 'position', 'positions')}, and the ${resume.theme} theme.`,
  )
  return { resume, notes }
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** Filename stem shared by the HTML and JSON downloads. */
export function resumeSlug(resume: Resume): string {
  return (
    resume.contact.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'resume'
  )
}

export function downloadJson(resume: Resume): void {
  const blob = new Blob([resumeToJson(resume)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${resumeSlug(resume)}-resume.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
