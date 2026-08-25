import { parseCsvRecords, pick } from './csv'
import { readZip } from './zip'
import { MONTHS, isPresent, monthKey } from './dates'
import {
  blankEducation,
  blankPosition,
  newId,
  type Company,
  type Education,
  type IcFocus,
  type Position,
  type Resume,
  type Track,
} from '../types'

export interface ImportResult {
  resume: Partial<Resume>
  notes: string[]
}

/** Filenames we care about inside the export, matched loosely against the archive. */
const FILE_MATCHERS = {
  positions: /positions\.csv$/i,
  profile: /profile\.csv$/i,
  education: /education\.csv$/i,
  skills: /skills\.csv$/i,
  emails: /email[_ ]?addresses\.csv$/i,
} as const

export async function importFromZip(buffer: ArrayBuffer): Promise<ImportResult> {
  const entries = await readZip(buffer)
  const files: Record<string, string> = {}

  for (const [key, matcher] of Object.entries(FILE_MATCHERS)) {
    const entry = entries.find((e) => matcher.test(e.name))
    if (entry) files[key] = await entry.text()
  }

  if (!files.positions && !files.profile) {
    throw new Error(
      'No Positions.csv or Profile.csv found in the archive. Make sure this is the LinkedIn ' +
        '"Get a copy of your data" export.',
    )
  }
  return buildResume(files)
}

function buildResume(files: Record<string, string>): ImportResult {
  const notes: string[] = []
  const resume: Partial<Resume> = {}

  if (files.positions) {
    const companies = parsePositionsCsv(files.positions)
    const roleCount = companies.reduce((n, c) => n + c.positions.length, 0)
    if (roleCount) {
      resume.companies = companies
      notes.push(
        `Imported ${roleCount} position${roleCount === 1 ? '' : 's'} across ` +
          `${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}.`,
      )
      const promotions = companies.filter((c) => c.positions.length > 1)
      if (promotions.length) {
        notes.push(
          `Grouped multiple roles at ${promotions
            .map((c) => c.name)
            .join(', ')} — tenure is calculated for you.`,
        )
      }
    } else {
      notes.push('Positions.csv was present but contained no rows.')
    }
  } else {
    notes.push('No Positions.csv found — work history left empty.')
  }

  if (files.profile) {
    const rows = parseCsvRecords(files.profile)
    const p = rows[0]
    if (p) {
      const first = pick(p, 'First Name')
      const last = pick(p, 'Last Name')
      const websites = pick(p, 'Websites')
      resume.contact = {
        name: [first, last].filter(Boolean).join(' '),
        headline: pick(p, 'Headline'),
        email: files.emails ? primaryEmail(files.emails) : '',
        phone: '',
        location: pick(p, 'Geo Location', 'Location'),
        linkedinUrl: '',
        githubUrl: findWebsite(websites, /github\.com/i),
        websiteUrl: findWebsite(websites, null),
        // LinkedIn's export has no profile picture, so a headshot is always an upload.
        photo: '',
      }
      const summary = pick(p, 'Summary')
      if (summary) resume.summary = summary
      notes.push('Imported name, headline, and location from Profile.csv.')
    }
  }

  if (files.education) {
    const education = parseEducationCsv(files.education)
    if (education.length) {
      resume.education = education
      notes.push(`Imported ${education.length} education entr${education.length === 1 ? 'y' : 'ies'}.`)
    }
  }

  if (files.skills) {
    const items = parseCsvRecords(files.skills)
      .map((r) => pick(r, 'Name', 'Skill'))
      .filter(Boolean)
    if (items.length) {
      resume.skills = [{ id: newId('skl'), label: 'Skills', items: items.join(', ') }]
      notes.push(`Imported ${items.length} skills — regroup them into labelled categories.`)
    }
  }

  notes.push('LinkedIn exports carry no achievement bullets; write those yourself for each role.')
  notes.push('Check each role’s track and scope inputs — both are guessed from the job title.')
  return { resume, notes }
}

/**
 * Handle a bare Positions.csv dragged out of an already-unzipped export. Runs the
 * same parsing and company grouping as the ZIP path.
 */
export function importFromPositionsCsv(text: string): ImportResult {
  const records = parseCsvRecords(text)
  const looksLikePositions = records.some((r) =>
    ['Company Name', 'Company', 'Title', 'Position', 'Started On'].some((k) => k in r),
  )
  if (!looksLikePositions) {
    throw new Error('That CSV does not look like a LinkedIn Positions.csv.')
  }
  return buildResume({ positions: text })
}

/** Titles that mean people-management rather than an IC role. */
const MANAGER_TITLE = /\b(manager|director|head of|vp|vice president|chief|cto|ceo|lead of|supervisor)\b/i
const TEAM_LEAD_TITLE = /\b(tech(nical)? lead|team lead|lead engineer|staff|principal)\b/i
const FRONTEND_TITLE = /\b(front[\s-]?end|ui|web|react|frontend)\b/i
const BACKEND_TITLE = /\b(back[\s-]?end|backend|platform|infrastructure|services?|api|data)\b/i
const FULLSTACK_TITLE = /\b(full[\s-]?stack|fullstack|software engineer|sde|developer|swe)\b/i

/** Guess the track from the title; the editor makes this easy to correct. */
function guessTrack(title: string): Track {
  return MANAGER_TITLE.test(title) ? 'manager' : 'ic'
}

/**
 * Guess IC focus areas from the title. Only ever returns what the title actually
 * evidences — an unrecognized title yields nothing rather than a wrong guess.
 */
function guessFocus(title: string): IcFocus[] {
  const focus: IcFocus[] = []
  if (FRONTEND_TITLE.test(title)) focus.push('Front-end Engineering')
  if (BACKEND_TITLE.test(title)) focus.push('Back-end Engineering')
  if (!focus.length && FULLSTACK_TITLE.test(title)) focus.push('Fullstack Engineering')
  if (TEAM_LEAD_TITLE.test(title)) focus.push('Team Lead')
  return focus.slice(0, 3)
}

function parsePositionsCsv(text: string): Company[] {
  const rows = parseCsvRecords(text)
    .map((r) => {
      const company = pick(r, 'Company Name', 'Company')
      const title = pick(r, 'Title', 'Position')
      if (!company && !title) return null
      const track = guessTrack(title)
      return {
        company,
        location: pick(r, 'Location'),
        position: {
          ...blankPosition(),
          id: newId('pos'),
          title,
          startDate: normalizeDate(pick(r, 'Started On', 'Start Date')),
          endDate: normalizeDate(pick(r, 'Finished On', 'End Date')) || 'Present',
          track,
          focus: track === 'ic' ? guessFocus(title) : [],
          // LinkedIn crams the whole role write-up into Description; split to bullets.
          bullets: descriptionToBullets(pick(r, 'Description')),
        } satisfies Position,
      }
    })
    .filter((r): r is { company: string; location: string; position: Position } => r !== null)

  return groupByCompany(rows)
}

/**
 * Collapse rows into one entry per employer, newest company first and newest role
 * first within each. Companies are matched case-insensitively on a normalized name
 * so "Acme, Inc." and "Acme Inc" don't split a tenure in two.
 */
function groupByCompany(
  rows: { company: string; location: string; position: Position }[],
): Company[] {
  const byKey = new Map<string, Company>()

  for (const row of rows) {
    const key = companyKey(row.company)
    let entry = byKey.get(key)
    if (!entry) {
      entry = { id: newId('co'), name: row.company, location: row.location, positions: [] }
      byKey.set(key, entry)
    }
    // Keep the longest name variant ("Acme, Inc." over "Acme") and any location we find.
    if (row.company.length > entry.name.length) entry.name = row.company
    if (!entry.location) entry.location = row.location
    entry.positions.push(row.position)
  }

  const companies = [...byKey.values()]
  for (const c of companies) c.positions.sort(byStartDateDesc)
  return companies.sort(
    (a, b) => latestStart(b.positions) - latestStart(a.positions),
  )
}

const companyKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh|plc)\b/g, '')
    .replace(/[^a-z0-9]/g, '')

const latestStart = (positions: Position[]): number =>
  positions.reduce((max, p) => Math.max(max, monthKey(p.startDate, 0) ?? 0), 0)

function parseEducationCsv(text: string): Education[] {
  return parseCsvRecords(text)
    .map((r) => {
      const school = pick(r, 'School Name', 'School')
      if (!school) return null
      return {
        ...blankEducation(),
        id: newId('edu'),
        school,
        degree: pick(r, 'Degree Name', 'Degree'),
        field: pick(r, 'Field Of Study', 'Notes'),
        startDate: normalizeDate(pick(r, 'Start Date')),
        endDate: normalizeDate(pick(r, 'End Date')),
      } satisfies Education
    })
    .filter((e): e is Education => e !== null)
    .sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''))
}

/**
 * LinkedIn dates arrive as "Jan 2019", "2019", or "2019-01-15" depending on the
 * field and export vintage. Normalize to "Mon YYYY" (or bare "YYYY") so the
 * rendered resume is internally consistent.
 */
export function normalizeDate(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^present$/i.test(value)) return 'Present'

  const iso = value.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  if (iso) return `${MONTHS[Number(iso[2]) - 1] ?? ''} ${iso[1]}`.trim()

  const monthYear = value.match(/^([A-Za-z]{3,9})\s+(\d{4})$/)
  if (monthYear) {
    const idx = MONTHS.findIndex((m) => monthYear[1].toLowerCase().startsWith(m.toLowerCase()))
    return idx >= 0 ? `${MONTHS[idx]} ${monthYear[2]}` : value
  }

  return value
}

/** Sort key: newest first, with current roles ("Present"/blank end) on top. */
function byStartDateDesc(a: Position, b: Position): number {
  const delta = (monthKey(b.startDate, 0) ?? 0) - (monthKey(a.startDate, 0) ?? 0)
  if (delta !== 0) return delta
  // Same start month: the role still held is the later one.
  return Number(isPresent(b.endDate)) - Number(isPresent(a.endDate))
}

/** Split a free-text role description into bullet candidates. */
export function descriptionToBullets(description: string): string[] {
  const text = description.trim()
  if (!text) return ['']

  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*[-•*·–—]\s*/, '').trim())
    .filter(Boolean)

  // Single blob with no line breaks: fall back to sentence splitting.
  if (lines.length === 1 && lines[0].length > 200) {
    const sentences = lines[0]
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (sentences.length > 1) return sentences
  }
  return lines.length ? lines : ['']
}

function primaryEmail(text: string): string {
  const rows = parseCsvRecords(text)
  const confirmed = rows.find((r) => /yes/i.test(pick(r, 'Primary')))
  return pick(confirmed ?? rows[0] ?? {}, 'Email Address', 'Email')
}

/**
 * Pull a URL out of LinkedIn's Websites column, which looks like
 * "[PERSONAL:https://me.dev],[OTHER:https://github.com/me]".
 * `match` filters to a specific host; pass null for the first non-GitHub URL.
 */
function findWebsite(raw: string, match: RegExp | null): string {
  if (!raw) return ''
  const urls = raw.match(/https?:\/\/[^\s,\]]+/g) ?? []
  if (!urls.length) return match ? '' : raw.split(',')[0].trim()
  if (match) return urls.find((u) => match.test(u)) ?? ''
  return urls.find((u) => !/github\.com/i.test(u)) ?? ''
}

/**
 * Fallback path: parse text pasted straight off a LinkedIn Experience section.
 * The rendered page repeats the company name on the line after the title and
 * uses an en-dash date range, e.g.
 *
 *   Senior Engineering Manager
 *   Acme Corp · Full-time
 *   Jan 2020 - Present · 4 yrs
 *   Seattle, WA
 */
export function importFromPastedText(text: string): ImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^(?:Company Logo|·|…see more|see more)$/i.test(l))

  const dateRange = /^([A-Za-z]{3,9}\.?\s*\d{4}|\d{4})\s*[-–—to]+\s*(Present|[A-Za-z]{3,9}\.?\s*\d{4}|\d{4})/i
  const rows: { company: string; location: string; position: Position }[] = []
  let current: { company: string; location: string; position: Position } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(dateRange)

    if (match && current) {
      current.position.startDate = normalizeDate(match[1].replace('.', ''))
      current.position.endDate = normalizeDate(match[2].replace('.', ''))
      continue
    }

    // A line containing "·" after a date line is usually employment type or location.
    if (current && current.position.startDate && !current.location && /^[A-Z]/.test(line) && !match) {
      const cleaned = line.split('·')[0].trim()
      if (/,|remote/i.test(cleaned)) {
        current.location = cleaned
        continue
      }
    }

    // Heuristic: a title line is followed by a company line, then a date line.
    const next = lines[i + 1]
    const afterNext = lines[i + 2]
    const looksLikeHeader = next && (dateRange.test(next) || (afterNext && dateRange.test(afterNext)))

    if (looksLikeHeader && !dateRange.test(line)) {
      if (current) rows.push(current)
      const track = guessTrack(line)
      current = {
        company: '',
        location: '',
        position: {
          ...blankPosition(),
          id: newId('pos'),
          title: line,
          track,
          focus: track === 'ic' ? guessFocus(line) : [],
          bullets: [],
        },
      }
      if (next && !dateRange.test(next)) {
        current.company = next.split('·')[0].trim()
        i++
      }
      continue
    }

    if (current) current.position.bullets.push(line.replace(/^\s*[-•*·–—]\s*/, '').trim())
  }
  if (current) rows.push(current)

  for (const row of rows) {
    row.position.endDate = row.position.endDate || 'Present'
    const filled = row.position.bullets.filter(Boolean)
    row.position.bullets = filled.length ? filled : ['']
  }

  const companies = groupByCompany(rows)
  const roleCount = rows.length

  return {
    resume: { companies },
    notes: roleCount
      ? [
          `Parsed ${roleCount} position${roleCount === 1 ? '' : 's'} across ` +
            `${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}.`,
          'Pasted-text parsing is best-effort — check every title, company, and date.',
        ]
      : ['Could not find any positions in the pasted text. Expected lines like "Jan 2020 - Present".'],
  }
}
