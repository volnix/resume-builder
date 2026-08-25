import type { Company, Resume } from '../types'
import { companyTenure } from './dates'
import {
  escapeHtml as esc,
  indentLines,
  listItem,
  markdownBulletItems,
  renderMarkdown,
} from './markdown'
import { isSafePhoto } from './photo'
import { resumeSlug } from './resumeJson'
import { effectiveScope } from './scope'
import { getTheme, themeStylesheet, type Theme } from './themes'

/** Strip the scheme for display but keep the full URL in href. */
const displayUrl = (url: string): string => url.replace(/^https?:\/\//, '').replace(/\/$/, '')

const withScheme = (url: string): string => (/^https?:\/\//.test(url) ? url : `https://${url}`)

function dateRange(start: string, end: string): string {
  if (!start && !end) return ''
  if (!end) return esc(start)
  if (!start) return esc(end)
  return `${esc(start)} – ${esc(end)}`
}

const join = (parts: string[]): string => parts.join('<span class="sep">•</span>')

/** Line 1: where to reach you. */
function contactLine(r: Resume): string {
  const c = r.contact
  const parts: string[] = []
  if (c.location) parts.push(esc(c.location))
  if (c.phone) parts.push(esc(c.phone))
  if (c.email) parts.push(`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`)
  return join(parts)
}

/** Line 2: where to read more about you. */
function linksLine(r: Resume): string {
  const c = r.contact
  const parts = [c.linkedinUrl, c.githubUrl, c.websiteUrl]
    .filter(Boolean)
    .map((url) => `<a href="${esc(withScheme(url))}">${esc(displayUrl(url))}</a>`)
  return join(parts)
}

/**
 * One block per employer: company name and derived tenure on top, then each
 * position held there. Multiple positions render as a promotion ladder, newest
 * first, so advancement is visible without the reader doing date arithmetic.
 */
function companyBlock(c: Company): string {
  const roles = c.positions.filter((p) => p.title || p.bullets.some((b) => b.trim()))
  if (!roles.length && !c.name) return ''

  const tenure = companyTenure(c.positions)
  const meta = [c.location && esc(c.location), tenure.duration && esc(tenure.duration)].filter(Boolean)
  const showRoleDates = roles.length > 1

  const items = roles
    .map((p) => {
      // Each achievement box is Markdown, and may expand into several bullets.
      const bullets = p.bullets.flatMap((b) => markdownBulletItems(b))
      const scope = effectiveScope(p)
      return `        <div class="role">
          <div class="role-head">
            <h4 class="role-title">${esc(p.title)}</h4>
${showRoleDates ? `            <div class="role-dates">${dateRange(p.startDate, p.endDate)}</div>\n` : ''}          </div>
${scope ? `          <p class="role-scope">${esc(scope)}</p>\n` : ''}${
        bullets.length
          ? `          <ul class="bullets">\n${bullets.map((b) => listItem(b, '            ')).join('\n')}\n          </ul>\n`
          : ''
      }        </div>`
    })
    .join('\n')

  return `      <article class="company${roles.length > 1 ? ' has-promotions' : ''}">
        <header class="company-head">
          <h3 class="company-name">${esc(c.name)}</h3>
          <div class="company-dates">${tenure.range ? esc(tenure.range) : ''}</div>
        </header>
${meta.length ? `        <p class="company-meta">${join(meta)}</p>\n` : ''}${items}
      </article>`
}

function experienceSection(r: Resume): string {
  const blocks = r.companies.map(companyBlock).filter(Boolean)
  if (!blocks.length) return ''
  return `    <section>
      <h2 class="section-title">Professional Experience</h2>
${blocks.join('\n')}
    </section>`
}

function skillsSection(r: Resume): string {
  const groups = r.skills.filter((g) => g.items.trim())
  if (!groups.length) return ''
  const rows = groups
    .map(
      (g) => `        <div class="skill-row">
          ${g.label ? `<span class="skill-label">${esc(g.label)}</span>` : ''}
          <span class="skill-items">${esc(g.items)}</span>
        </div>`,
    )
    .join('\n')
  return `    <section>
      <h2 class="section-title">Core Competencies</h2>
      <div class="skills">
${rows}
      </div>
    </section>`
}

function educationSection(r: Resume): string {
  const entries = r.education.filter((e) => e.school)
  if (!entries.length) return ''
  const items = entries
    .map((e) => {
      const degree = [e.degree, e.field].filter(Boolean).join(', ')
      return `      <div class="edu">
        <div class="edu-id">
          <span class="edu-school">${esc(e.school)}</span>
          ${degree ? `<span class="edu-degree">${esc(degree)}</span>` : ''}
        </div>
        <div class="role-dates">${dateRange(e.startDate, e.endDate)}</div>
      </div>`
    })
    .join('\n')
  return `    <section>
      <h2 class="section-title">Education</h2>
${items}
    </section>`
}

function summarySection(r: Resume): string {
  const body = renderMarkdown(r.summary)
  if (!body) return ''
  return `    <section>
      <h2 class="section-title">Summary</h2>
      <div class="summary">
${indentLines(body, '        ')}
      </div>
    </section>`
}

/**
 * The masthead. All themes emit the same structure; only a theme that opts into a
 * photo gets the `<img>`, and only when the stored photo is a safe data URL.
 */
function masthead(r: Resume, theme: Theme, name: string): string {
  const contact = contactLine(r)
  const links = linksLine(r)
  const photo = theme.usesPhoto && isSafePhoto(r.contact.photo) ? r.contact.photo : ''

  const identity = [
    `        <div class="identity">`,
    `          <h1>${esc(name)}</h1>`,
    r.contact.headline ? `          <p class="headline">${esc(r.contact.headline)}</p>` : '',
    contact ? `          <p class="contact">${contact}</p>` : '',
    links ? `          <p class="links">${links}</p>` : '',
    `        </div>`,
  ].filter(Boolean)

  return [
    `    <header class="masthead">`,
    `      <div class="masthead-inner">`,
    photo ? `        <img class="photo" src="${esc(photo)}" alt="${esc(name)}">` : '',
    ...identity,
    `      </div>`,
    `    </header>`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Renders a standalone, print-ready HTML resume in the resume's chosen theme. No
 * external assets or scripts — the headshot is inlined as a data URL — so the
 * downloaded file works offline and prints identically everywhere.
 */
export function renderResumeHtml(r: Resume): string {
  const theme = getTheme(r.theme)
  const name = r.contact.name.trim() || 'Resume'
  const sections = [summarySection(r), experienceSection(r), skillsSection(r), educationSection(r)]
    .filter(Boolean)
    .join('\n')

  return `<!doctype html>
<html lang="en" data-theme="${theme.id}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} — Resume</title>
<style>
${themeStylesheet(theme.id)}
</style>
</head>
<body>
  <div class="page">
${masthead(r, theme, name)}
${sections}
  </div>
</body>
</html>
`
}

export function downloadHtml(resume: Resume): void {
  const blob = new Blob([renderResumeHtml(resume)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${resumeSlug(resume)}-resume.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
