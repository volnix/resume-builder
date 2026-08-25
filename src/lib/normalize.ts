import {
  blankEducation,
  blankPosition,
  blankSkillGroup,
  DEFAULT_THEME,
  emptyResume,
  newId,
  type Company,
  type Education,
  type Position,
  type Resume,
  type SkillGroup,
} from '../types'
import { cleanPhoto } from './photo'
import { isThemeId } from './themes'

/** Shape of a v1 save, before experience was grouped by company. */
interface LegacyPosition extends Partial<Position> {
  company?: string
  location?: string
}

export interface SavedResume extends Partial<Omit<Resume, 'companies'>> {
  companies?: Partial<Company>[]
  /** v1 only: a flat list of positions each carrying its own company name. */
  positions?: LegacyPosition[]
}

/**
 * Turn anything that claims to be a resume — a localStorage save, a JSON file, a
 * save written by an older version — into a complete, current-shape Resume.
 * Unknown fields are dropped and missing ones are defaulted, so every consumer
 * downstream can rely on the model instead of guarding each field.
 *
 * `notes` collects anything the user should know about (a dropped photo, an
 * unrecognized theme); pass it in when the result is user-visible.
 */
export function normalizeResume(raw: unknown, notes: string[] = []): Resume {
  const base = emptyResume()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const saved = raw as SavedResume

  const theme = saved.theme
  if (theme !== undefined && !isThemeId(theme)) {
    notes.push(`Unknown theme "${String(theme)}" — using ${DEFAULT_THEME}.`)
  }

  const photo = cleanPhoto(saved.contact?.photo)
  if (saved.contact?.photo && !photo) {
    notes.push('The headshot was dropped: only embedded PNG, JPEG, WebP, GIF, or AVIF images are accepted.')
  }

  return {
    theme: isThemeId(theme) ? theme : base.theme,
    contact: { ...base.contact, ...saved.contact, photo },
    summary: typeof saved.summary === 'string' ? saved.summary : base.summary,
    companies: readCompanies(saved),
    education: asArray(saved.education).map(normalizeEducation),
    skills: asArray(saved.skills).map(normalizeSkillGroup),
  }
}

const asArray = <T,>(value: T[] | undefined): Partial<T>[] => (Array.isArray(value) ? value : [])

/** Accept both the current company-grouped shape and the flat v1 shape. */
function readCompanies(saved: SavedResume): Company[] {
  if (Array.isArray(saved.companies)) return saved.companies.map(normalizeCompany)
  if (Array.isArray(saved.positions)) return migratePositions(saved.positions)
  return []
}

/** Fill in fields added after a save was written, so old data stays editable. */
function normalizeCompany(c: Partial<Company>): Company {
  return {
    id: c.id ?? newId('co'),
    name: c.name ?? '',
    location: c.location ?? '',
    positions: asArray(c.positions).map(normalizePosition),
  }
}

function normalizePosition(p: Partial<Position>): Position {
  const blank = blankPosition()
  return {
    ...blank,
    ...p,
    id: p.id ?? blank.id,
    focus: Array.isArray(p.focus) ? p.focus : [],
    bullets: Array.isArray(p.bullets) ? p.bullets.filter((b) => typeof b === 'string') : blank.bullets,
  }
}

const normalizeEducation = (e: Partial<Education>): Education => ({ ...blankEducation(), ...e })

const normalizeSkillGroup = (g: Partial<SkillGroup>): SkillGroup => ({ ...blankSkillGroup(), ...g })

/**
 * v1 → v2: collapse a flat position list into one entry per employer, preserving
 * order. Consecutive roles at the same company become that company's ladder.
 */
function migratePositions(positions: LegacyPosition[]): Company[] {
  const companies: Company[] = []
  const byKey = new Map<string, Company>()

  for (const { company = '', location = '', ...rest } of positions) {
    const key = company.toLowerCase().replace(/[^a-z0-9]/g, '')
    let entry = byKey.get(key)
    if (!entry) {
      entry = { id: newId('co'), name: company, location, positions: [] }
      byKey.set(key, entry)
      companies.push(entry)
    }
    if (!entry.location && location) entry.location = location
    // A v1 scope line was free text, which is exactly the manual-override field.
    entry.positions.push(normalizePosition(rest))
  }
  return companies
}

/** True when there's nothing worth overwriting — used to skip a confirm prompt. */
export function isResumeEmpty(r: Resume): boolean {
  return (
    !r.summary.trim() &&
    !r.companies.length &&
    !r.education.length &&
    !r.skills.length &&
    Object.values(r.contact).every((v) => !v)
  )
}
