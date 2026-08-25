export interface Contact {
  name: string
  headline: string
  /** Line 1 of the masthead: phone, email, address. */
  email: string
  phone: string
  location: string
  /** Line 2 of the masthead: profile and portfolio links. */
  linkedinUrl: string
  githubUrl: string
  websiteUrl: string
  /**
   * Headshot as an image data URL, or '' for none. Inlined rather than linked so
   * the exported file stays self-contained, and only printed by themes that opt
   * into a photo.
   */
  photo: string
}

/** Which stylesheet the exported resume is rendered with. */
export type ThemeId = 'classic' | 'modern' | 'portrait'

export const DEFAULT_THEME: ThemeId = 'classic'

/** Which career track a role was on. Drives how its scope line is generated. */
export type Track = 'manager' | 'ic'

/** Fixed IC focus list — an IC scope line is generated from up to 3 of these. */
export const IC_FOCUS_OPTIONS = [
  'Fullstack Engineering',
  'Back-end Engineering',
  'Front-end Engineering',
  'Project Management',
  'Team Lead',
] as const

export type IcFocus = (typeof IC_FOCUS_OPTIONS)[number]

export const IC_FOCUS_MAX = 3

export interface Position {
  id: string
  title: string
  startDate: string
  endDate: string
  track: Track
  /** Manager track: total org headcount. Free text so "20+" is allowed. */
  teamSize: string
  /** Manager track: number of direct reports. */
  directReports: string
  /** IC track: up to IC_FOCUS_MAX entries from IC_FOCUS_OPTIONS. */
  focus: IcFocus[]
  /** Overrides the generated scope line when non-empty. */
  scope: string
  bullets: string[]
}

/**
 * A tenure at one employer, holding every position held there. Grouping this way
 * puts promotions in one block so advancement reads at a glance, and lets the
 * overall tenure be derived rather than typed.
 */
export interface Company {
  id: string
  name: string
  location: string
  positions: Position[]
}

export interface Education {
  id: string
  school: string
  degree: string
  field: string
  startDate: string
  endDate: string
}

export interface SkillGroup {
  id: string
  label: string
  items: string
}

export interface Resume {
  /** Presentation only — the content below is identical across themes. */
  theme: ThemeId
  contact: Contact
  summary: string
  companies: Company[]
  education: Education[]
  skills: SkillGroup[]
}

export const emptyResume = (): Resume => ({
  theme: DEFAULT_THEME,
  contact: {
    name: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    linkedinUrl: '',
    githubUrl: '',
    websiteUrl: '',
    photo: '',
  },
  summary: '',
  companies: [],
  education: [],
  skills: [],
})

let seq = 0
export const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`

export const blankPosition = (): Position => ({
  id: newId('pos'),
  title: '',
  startDate: '',
  endDate: '',
  track: 'manager',
  teamSize: '',
  directReports: '',
  focus: [],
  scope: '',
  bullets: [''],
})

export const blankCompany = (): Company => ({
  id: newId('co'),
  name: '',
  location: '',
  positions: [blankPosition()],
})

export const blankEducation = (): Education => ({
  id: newId('edu'),
  school: '',
  degree: '',
  field: '',
  startDate: '',
  endDate: '',
})

export const blankSkillGroup = (): SkillGroup => ({
  id: newId('skl'),
  label: '',
  items: '',
})
