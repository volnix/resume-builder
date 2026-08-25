import { companyTenure } from '../lib/dates'
import { generateScopeLine, toggleFocus } from '../lib/scope'
import {
  blankCompany,
  blankEducation,
  blankPosition,
  blankSkillGroup,
  IC_FOCUS_MAX,
  IC_FOCUS_OPTIONS,
  type Company,
  type Contact,
  type IcFocus,
  type Position,
  type Resume,
  type Track,
} from '../types'

interface Props {
  resume: Resume
  onChange: (next: Resume) => void
}

/** Shared reminder of the Markdown the renderer understands. */
const MARKDOWN_TIP = 'Markdown: **bold**, *italic*, `code`, [text](url), "- " for a list.'

/** Suggested competency groupings for an engineering resume. */
const SKILL_PRESETS: { label: string; items: string }[] = [
  { label: 'Leadership', items: 'Org design, Hiring & onboarding, Performance management, Mentoring, Succession planning' },
  { label: 'Delivery', items: 'Agile/Scrum, Roadmap planning, Cross-team programs, Incident response, SLO ownership' },
  { label: 'Technical', items: 'Distributed systems, Cloud architecture (AWS), CI/CD, Observability, API design' },
  { label: 'Business', items: 'Stakeholder alignment, Budget ownership, Vendor management, Technical strategy' },
]

export default function Editor({ resume, onChange }: Props) {
  const patch = (fields: Partial<Resume>) => onChange({ ...resume, ...fields })
  const patchContact = (fields: Partial<Contact>) =>
    patch({ contact: { ...resume.contact, ...fields } })

  const updateCompany = (id: string, fields: Partial<Company>) =>
    patch({ companies: resume.companies.map((c) => (c.id === id ? { ...c, ...fields } : c)) })

  const updatePosition = (companyId: string, positionId: string, fields: Partial<Position>) =>
    patch({
      companies: resume.companies.map((c) =>
        c.id === companyId
          ? { ...c, positions: c.positions.map((p) => (p.id === positionId ? { ...p, ...fields } : p)) }
          : c,
      ),
    })

  const move = <T,>(list: T[], index: number, delta: number): T[] | null => {
    const target = index + delta
    if (target < 0 || target >= list.length) return null
    const next = [...list]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  }

  const moveCompany = (index: number, delta: number) => {
    const next = move(resume.companies, index, delta)
    if (next) patch({ companies: next })
  }

  const movePosition = (company: Company, index: number, delta: number) => {
    const next = move(company.positions, index, delta)
    if (next) updateCompany(company.id, { positions: next })
  }

  return (
    <>
      <section className="panel">
        <h2>2 · Contact &amp; Summary</h2>
        <div className="grid-2">
          <Field label="Full name" value={resume.contact.name} onChange={(v) => patchContact({ name: v })} />
          <Field
            label="Headline"
            placeholder="Senior Engineering Manager · Platform &amp; Infrastructure"
            value={resume.contact.headline}
            onChange={(v) => patchContact({ headline: v })}
          />
        </div>

        <fieldset className="subgroup">
          <legend>Contact line</legend>
          <p className="hint">Renders as the first line under your name.</p>
          <div className="grid-3">
            <Field label="Phone" placeholder="(555) 010-0100" value={resume.contact.phone} onChange={(v) => patchContact({ phone: v })} />
            <Field label="Email" placeholder="you@example.com" value={resume.contact.email} onChange={(v) => patchContact({ email: v })} />
            <Field label="Address" placeholder="Seattle, WA" value={resume.contact.location} onChange={(v) => patchContact({ location: v })} />
          </div>
        </fieldset>

        <fieldset className="subgroup">
          <legend>Links line</legend>
          <p className="hint">Renders as a separate second line, so neither line wraps awkwardly.</p>
          <div className="grid-3">
            <Field label="LinkedIn" placeholder="linkedin.com/in/you" value={resume.contact.linkedinUrl} onChange={(v) => patchContact({ linkedinUrl: v })} />
            <Field label="GitHub" placeholder="github.com/you" value={resume.contact.githubUrl} onChange={(v) => patchContact({ githubUrl: v })} />
            <Field label="Personal website" placeholder="you.dev" value={resume.contact.websiteUrl} onChange={(v) => patchContact({ websiteUrl: v })} />
          </div>
        </fieldset>

        <label className="field">
          <span>
            Summary{' '}
            <em className="tip">
              3–4 lines: scope of work, domain, and the outcome you drive.
              <br />
              {MARKDOWN_TIP} A blank line starts a new paragraph.
            </em>
          </span>
          <textarea
            rows={5}
            value={resume.summary}
            placeholder="Engineering manager with 9 years leading platform teams (currently 24 engineers across 3 teams)…"
            onChange={(e) => patch({ summary: e.target.value })}
          />
        </label>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>3 · Experience by company</h2>
          <button className="btn" onClick={() => patch({ companies: [blankCompany(), ...resume.companies] })}>
            + Add company
          </button>
        </div>
        <p className="hint">
          Group every role held at one employer under that company. Tenure is calculated from the
          positions, and multiple positions render as a promotion ladder.
        </p>

        {resume.companies.length === 0 && (
          <p className="hint">No companies yet — import from LinkedIn or add one.</p>
        )}

        {resume.companies.map((company, cIndex) => {
          const tenure = companyTenure(company.positions)
          return (
            <div className="card company-card" key={company.id}>
              <div className="card-head">
                <div>
                  <strong>{company.name || 'Untitled company'}</strong>
                  <span className="tenure">{tenure.label || 'Add dates below for tenure'}</span>
                </div>
                <div className="card-actions">
                  <button className="btn-icon" title="Move company up" disabled={cIndex === 0} onClick={() => moveCompany(cIndex, -1)}>
                    ↑
                  </button>
                  <button
                    className="btn-icon"
                    title="Move company down"
                    disabled={cIndex === resume.companies.length - 1}
                    onClick={() => moveCompany(cIndex, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="btn-icon danger"
                    title="Remove company"
                    onClick={() => patch({ companies: resume.companies.filter((x) => x.id !== company.id) })}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="grid-2">
                <Field label="Company" value={company.name} onChange={(v) => updateCompany(company.id, { name: v })} />
                <Field
                  label="Location"
                  placeholder="Seattle, WA"
                  value={company.location}
                  onChange={(v) => updateCompany(company.id, { location: v })}
                />
              </div>

              {company.positions.map((p, pIndex) => (
                <PositionCard
                  key={p.id}
                  position={p}
                  index={pIndex}
                  total={company.positions.length}
                  onMove={(delta) => movePosition(company, pIndex, delta)}
                  onRemove={() =>
                    updateCompany(company.id, {
                      positions: company.positions.filter((x) => x.id !== p.id),
                    })
                  }
                  onChange={(fields) => updatePosition(company.id, p.id, fields)}
                />
              ))}

              <button
                className="btn subtle"
                onClick={() =>
                  updateCompany(company.id, { positions: [blankPosition(), ...company.positions] })
                }
              >
                + Add position at {company.name || 'this company'}
              </button>
            </div>
          )
        })}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>4 · Core Competencies</h2>
          <div className="card-actions">
            {resume.skills.length === 0 && (
              <button
                className="btn subtle"
                onClick={() =>
                  patch({ skills: SKILL_PRESETS.map((preset) => ({ ...blankSkillGroup(), ...preset })) })
                }
              >
                Use manager preset
              </button>
            )}
            <button className="btn" onClick={() => patch({ skills: [...resume.skills, blankSkillGroup()] })}>
              + Add group
            </button>
          </div>
        </div>
        {resume.skills.map((g) => (
          <div className="grid-skill" key={g.id}>
            <Field
              label="Group"
              placeholder="Leadership"
              value={g.label}
              onChange={(v) => patch({ skills: resume.skills.map((x) => (x.id === g.id ? { ...x, label: v } : x)) })}
            />
            <Field
              label="Items (comma separated)"
              value={g.items}
              onChange={(v) => patch({ skills: resume.skills.map((x) => (x.id === g.id ? { ...x, items: v } : x)) })}
            />
            <button
              className="btn-icon danger"
              title="Remove group"
              onClick={() => patch({ skills: resume.skills.filter((x) => x.id !== g.id) })}
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>5 · Education</h2>
          <button className="btn" onClick={() => patch({ education: [...resume.education, blankEducation()] })}>
            + Add school
          </button>
        </div>
        {resume.education.map((e) => (
          <div className="card" key={e.id}>
            <div className="grid-2">
              <Field
                label="School"
                value={e.school}
                onChange={(v) => patch({ education: resume.education.map((x) => (x.id === e.id ? { ...x, school: v } : x)) })}
              />
              <Field
                label="Degree"
                placeholder="B.S."
                value={e.degree}
                onChange={(v) => patch({ education: resume.education.map((x) => (x.id === e.id ? { ...x, degree: v } : x)) })}
              />
              <Field
                label="Field of study"
                value={e.field}
                onChange={(v) => patch({ education: resume.education.map((x) => (x.id === e.id ? { ...x, field: v } : x)) })}
              />
              <div className="grid-2 tight">
                <Field
                  label="Start"
                  value={e.startDate}
                  onChange={(v) => patch({ education: resume.education.map((x) => (x.id === e.id ? { ...x, startDate: v } : x)) })}
                />
                <Field
                  label="End"
                  value={e.endDate}
                  onChange={(v) => patch({ education: resume.education.map((x) => (x.id === e.id ? { ...x, endDate: v } : x)) })}
                />
              </div>
            </div>
            <button
              className="btn subtle danger"
              onClick={() => patch({ education: resume.education.filter((x) => x.id !== e.id) })}
            >
              Remove
            </button>
          </div>
        ))}
      </section>
    </>
  )
}

interface PositionCardProps {
  position: Position
  index: number
  total: number
  onMove: (delta: number) => void
  onRemove: () => void
  onChange: (fields: Partial<Position>) => void
}

function PositionCard({ position: p, index, total, onMove, onRemove, onChange }: PositionCardProps) {
  const generated = generateScopeLine(p)
  const radioName = `track-${p.id}`

  const setTrack = (track: Track) => onChange({ track })

  return (
    <div className="card position-card">
      <div className="card-head">
        <span className="position-label">{p.title || 'Untitled position'}</span>
        <div className="card-actions">
          <button className="btn-icon" title="Move position up" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button className="btn-icon" title="Move position down" disabled={index === total - 1} onClick={() => onMove(1)}>
            ↓
          </button>
          <button className="btn-icon danger" title="Remove position" disabled={total === 1} onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>

      <div className="grid-2">
        <Field label="Title" placeholder="Senior Engineering Manager" value={p.title} onChange={(v) => onChange({ title: v })} />
        <div className="grid-2 tight">
          <Field label="Start" placeholder="Jan 2020" value={p.startDate} onChange={(v) => onChange({ startDate: v })} />
          <Field label="End" placeholder="Present" value={p.endDate} onChange={(v) => onChange({ endDate: v })} />
        </div>
      </div>

      <fieldset className="track">
        <legend>Track</legend>
        <div className="radio-row">
          <label className="radio">
            <input
              type="radio"
              name={radioName}
              checked={p.track === 'manager'}
              onChange={() => setTrack('manager')}
            />
            <span>Manager</span>
          </label>
          <label className="radio">
            <input type="radio" name={radioName} checked={p.track === 'ic'} onChange={() => setTrack('ic')} />
            <span>Individual contributor</span>
          </label>
        </div>

        {p.track === 'manager' ? (
          <div className="grid-2 tight">
            <Field
              label="Team size"
              placeholder="24"
              hint="Total engineers in the org."
              value={p.teamSize}
              onChange={(v) => onChange({ teamSize: v })}
            />
            <Field
              label="Direct reports"
              placeholder="4"
              value={p.directReports}
              onChange={(v) => onChange({ directReports: v })}
            />
          </div>
        ) : (
          <div className="field">
            <span>
              Focus areas
              <em className="tip">
                Choose up to {IC_FOCUS_MAX} — {p.focus.length}/{IC_FOCUS_MAX} selected.
              </em>
            </span>
            <div className="checkbox-grid">
              {IC_FOCUS_OPTIONS.map((option) => {
                const checked = p.focus.includes(option)
                return (
                  <label className={`checkbox ${checked ? 'on' : ''}`} key={option}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && p.focus.length >= IC_FOCUS_MAX}
                      onChange={() => onChange({ focus: toggleFocus<IcFocus>(p.focus, option) })}
                    />
                    <span>{option}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div className="scope-preview">
          <span className="scope-preview-label">Generated scope line</span>
          <code>{generated || '— fill in the fields above —'}</code>
        </div>

        <Field
          label="Override scope line (optional)"
          placeholder={generated || 'Leave blank to use the generated line'}
          hint="Anything typed here replaces the generated line."
          value={p.scope}
          onChange={(v) => onChange({ scope: v })}
        />
      </fieldset>

      <div className="field">
        <span>
          Achievements{' '}
          <em className="tip">
            Lead with the result, then how. Quantify.
            <br />
            {MARKDOWN_TIP} Indented "- " lines become sub-bullets under the line above.
          </em>
        </span>
        {p.bullets.map((bullet, bIndex) => (
          <div className="bullet-row" key={bIndex}>
            <textarea
              rows={3}
              value={bullet}
              placeholder={'Cut deploy lead time from **6 days to 4 hours** by…\n  - rebuilt CI on ephemeral runners'}
              onChange={(e) => {
                const bullets = [...p.bullets]
                bullets[bIndex] = e.target.value
                onChange({ bullets })
              }}
            />
            <button
              className="btn-icon danger"
              title="Remove bullet"
              onClick={() => onChange({ bullets: p.bullets.filter((_, i) => i !== bIndex) })}
            >
              ✕
            </button>
          </div>
        ))}
        <button className="btn subtle" onClick={() => onChange({ bullets: [...p.bullets, ''] })}>
          + Add achievement
        </button>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hint?: string
}

function Field({ label, value, onChange, placeholder, hint }: FieldProps) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && <em className="tip">{hint}</em>}
      </span>
      <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
