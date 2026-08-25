/**
 * End-to-end check of the LinkedIn parsers, scope generation, tenure math,
 * storage migration, and HTML renderer. Run with: npm run verify
 */
import { parseCsvRecords } from '../src/lib/csv'
import {
  importFromZip,
  importFromPastedText,
  importFromPositionsCsv,
  normalizeDate,
  descriptionToBullets,
} from '../src/lib/linkedin'
import { renderResumeHtml } from '../src/lib/exportHtml'
import { markdownBulletItems, renderMarkdown } from '../src/lib/markdown'
import { companyTenure, formatDuration, monthKey } from '../src/lib/dates'
import { effectiveScope, generateScopeLine, toggleFocus } from '../src/lib/scope'
import { blankCompany, blankPosition, emptyResume, type IcFocus, type Position } from '../src/types'

let failures = 0
function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok   ${label}`)
  } else {
    failures++
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const position = (fields: Partial<Position>): Position => ({ ...blankPosition(), ...fields })

// ---------- CSV: quoted fields, embedded newlines, doubled quotes ----------
console.log('\nCSV parser')
const csv = [
  'Company Name,Title,Description,Started On',
  '"Acme, Inc.",Engineering Manager,"Led 3 teams.\nGrew org 8 -> 24.",Jan 2020',
  'Globex,"Sr. Manager, Platform","Said ""ship it"" a lot",Mar 2017',
].join('\n')
const records = parseCsvRecords(csv)
check('parses 2 rows', records.length === 2, `got ${records.length}`)
check('comma inside quotes', records[0]['Company Name'] === 'Acme, Inc.', records[0]['Company Name'])
check('newline inside quotes', records[0]['Description'].includes('\n'))
check('comma in title', records[1]['Title'] === 'Sr. Manager, Platform', records[1]['Title'])
check('escaped double quote', records[1]['Description'] === 'Said "ship it" a lot', records[1]['Description'])

// ---------- Date normalization ----------
console.log('\nDate normalization')
check('ISO full', normalizeDate('2019-01-15') === 'Jan 2019', normalizeDate('2019-01-15'))
check('ISO month', normalizeDate('2019-11') === 'Nov 2019', normalizeDate('2019-11'))
check('long month', normalizeDate('January 2019') === 'Jan 2019', normalizeDate('January 2019'))
check('bare year', normalizeDate('2019') === '2019')
check('present', normalizeDate('present') === 'Present')
check('empty', normalizeDate('') === '')

// ---------- Month keys and durations ----------
console.log('\nTenure math')
check('monthKey named', monthKey('Jan 2020') === 2020 * 12, String(monthKey('Jan 2020')))
check('monthKey ISO', monthKey('2020-01') === 2020 * 12, String(monthKey('2020-01')))
check('monthKey bare year uses fallback month', monthKey('2020', 11) === 2020 * 12 + 11)
check('monthKey rejects junk', monthKey('sometime') === null)
check('duration years and months', formatDuration(30) === '2 yrs 6 mos', formatDuration(30))
check('duration singular year', formatDuration(12) === '1 yr', formatDuration(12))
check('duration singular month', formatDuration(1) === '1 mo', formatDuration(1))
check('duration months only', formatDuration(5) === '5 mos', formatDuration(5))
check('duration ignores non-positive', formatDuration(0) === '' && formatDuration(-3) === '')

// Tenure spans every position at the company, inclusive of both end months.
const ladder = [
  position({ title: 'Senior Manager', startDate: 'Jan 2022', endDate: 'Dec 2024' }),
  position({ title: 'Manager', startDate: 'Jan 2020', endDate: 'Dec 2021' }),
]
const closed = companyTenure(ladder)
check('tenure spans all roles', closed.range === 'Jan 2020 – Dec 2024', closed.range)
check('tenure duration inclusive', closed.duration === '5 yrs', closed.duration)
check('tenure label joins both', closed.label === 'Jan 2020 – Dec 2024 · 5 yrs', closed.label)

const now = new Date(2026, 5, 15) // Jun 2026, injected so the check is stable
const open = companyTenure([position({ startDate: 'Jan 2024', endDate: 'Present' })], now)
check('current role reads Present', open.range === 'Jan 2024 – Present', open.range)
check('current role duration to now', open.duration === '2 yrs 6 mos', open.duration)
const blankEnd = companyTenure([position({ startDate: 'Jan 2026', endDate: '' })], now)
check('blank end treated as current', blankEnd.range === 'Jan 2026 – Present', blankEnd.range)
check('no dates -> empty tenure', companyTenure([position({})]).label === '')
check('unparseable start -> empty tenure', companyTenure([position({ startDate: 'a while ago' })]).label === '')

// ---------- Scope generation ----------
console.log('\nScope generation')
const mgr = position({ track: 'manager', teamSize: '24', directReports: '4' })
check('manager scope', generateScopeLine(mgr) === '24 engineers · 4 direct reports', generateScopeLine(mgr))
check(
  'manager scope singulars',
  generateScopeLine(position({ track: 'manager', teamSize: '1', directReports: '1' })) ===
    '1 engineer · 1 direct report',
)
check(
  'manager scope keeps "20+" plural',
  generateScopeLine(position({ track: 'manager', teamSize: '20+', directReports: '' })) === '20+ engineers',
)
check(
  'manager scope omits blank fields',
  generateScopeLine(position({ track: 'manager', teamSize: '', directReports: '3' })) === '3 direct reports',
)
check('manager scope all blank', generateScopeLine(position({ track: 'manager' })) === '')
check(
  'manager scope ignores focus',
  generateScopeLine(position({ track: 'manager', teamSize: '9', focus: ['Team Lead'] })) === '9 engineers',
)

const ic = position({ track: 'ic', focus: ['Back-end Engineering', 'Team Lead'] })
check('ic scope joins focus', generateScopeLine(ic) === 'Back-end Engineering · Team Lead', generateScopeLine(ic))
check('ic scope empty with no focus', generateScopeLine(position({ track: 'ic' })) === '')
check(
  'ic scope ignores manager fields',
  generateScopeLine(position({ track: 'ic', teamSize: '24', focus: ['Front-end Engineering'] })) ===
    'Front-end Engineering',
)
check(
  'ic scope caps at 3',
  generateScopeLine(
    position({
      track: 'ic',
      focus: ['Fullstack Engineering', 'Back-end Engineering', 'Front-end Engineering', 'Team Lead'] as IcFocus[],
    }),
  ) === 'Fullstack Engineering · Back-end Engineering · Front-end Engineering',
)

check('manual scope overrides generated', effectiveScope({ ...mgr, scope: 'Hand written' }) === 'Hand written')
check('blank manual scope falls back', effectiveScope({ ...mgr, scope: '   ' }) === '24 engineers · 4 direct reports')

// Focus toggle enforces the cap and is order-preserving.
const three: IcFocus[] = ['Fullstack Engineering', 'Back-end Engineering', 'Front-end Engineering']
check('toggle adds', toggleFocus<IcFocus>(['Team Lead'], 'Back-end Engineering').length === 2)
check('toggle removes', toggleFocus<IcFocus>(three, 'Back-end Engineering').length === 2)
check('toggle refuses a 4th', toggleFocus<IcFocus>(three, 'Team Lead') === three)
check('toggle can still remove at the cap', toggleFocus<IcFocus>(three, 'Fullstack Engineering').length === 2)

// ---------- ZIP import (build a real archive with Node's zlib) ----------
console.log('\nZIP import')
const positionsCsv = [
  'Company Name,Title,Description,Location,Started On,Finished On',
  '"Acme, Inc.",Senior Engineering Manager,"Led 3 teams (24 engineers).\nCut deploy time 6d -> 4h.",Seattle WA,2022-01,',
  'Acme Inc,Engineering Manager,Ran the payments team,Seattle WA,2020-01,2021-12',
  'Globex,Senior Back-end Engineer,Built billing services,Austin TX,2017-03,2019-12',
  'Initech,Front-end Developer,Built the customer console,Remote,2014-06,2017-02',
].join('\n')
const zipBuffer = await buildZip({
  'Positions.csv': positionsCsv,
  'Profile.csv': [
    'First Name,Last Name,Headline,Summary,Geo Location,Websites',
    'Jordan,Reyes,"Engineering Manager, Platform","Manager of managers.",Seattle Washington United States,"[PERSONAL:https://jreyes.dev],[OTHER:https://github.com/jreyes]"',
  ].join('\n'),
  'Education.csv': ['School Name,Degree Name,Field Of Study,Start Date,End Date', 'State University,B.S.,Computer Science,2010,2014'].join('\n'),
  'Skills.csv': ['Name', 'Distributed Systems', 'Team Leadership', 'AWS'].join('\n'),
  'Email Addresses.csv': ['Email Address,Confirmed,Primary', 'jordan@example.com,Yes,Yes'].join('\n'),
})
const imported = await importFromZip(zipBuffer)
const companies = imported.resume.companies ?? []
check('groups 4 rows into 3 companies', companies.length === 3, `got ${companies.length}`)
check('newest company first', companies[0].name === 'Acme, Inc.', companies[0].name)
check('oldest company last', companies[2].name === 'Initech', companies[2].name)
check('promotions grouped under one company', companies[0].positions.length === 2, `got ${companies[0].positions.length}`)
check('longest name variant kept', companies[0].name === 'Acme, Inc.', companies[0].name)
check('company location lifted off the row', companies[0].location === 'Seattle WA', companies[0].location)
check('newest role first within a company', companies[0].positions[0].title === 'Senior Engineering Manager', companies[0].positions[0].title)
check('start date normalized', companies[0].positions[0].startDate === 'Jan 2022', companies[0].positions[0].startDate)
check('blank end -> Present', companies[0].positions[0].endDate === 'Present', companies[0].positions[0].endDate)
check('real end date kept', companies[0].positions[1].endDate === 'Dec 2021', companies[0].positions[1].endDate)
check('description -> 2 bullets', companies[0].positions[0].bullets.length === 2, JSON.stringify(companies[0].positions[0].bullets))
check('derived tenure spans the promotion', companyTenure(companies[0].positions).range === 'Jan 2020 – Present')

// Track inference from the title.
check('manager title -> manager track', companies[0].positions[0].track === 'manager', companies[0].positions[0].track)
check('engineer title -> ic track', companies[1].positions[0].track === 'ic', companies[1].positions[0].track)
check('back-end title -> back-end focus', companies[1].positions[0].focus.includes('Back-end Engineering'), JSON.stringify(companies[1].positions[0].focus))
check('front-end title -> front-end focus', companies[2].positions[0].focus.includes('Front-end Engineering'), JSON.stringify(companies[2].positions[0].focus))
check('manager roles get no focus', companies[0].positions[0].focus.length === 0)
check('imported roles have no manual scope', companies[0].positions.every((p) => p.scope === ''))
check('notes flag the guessed track', imported.notes.some((n) => /track/i.test(n)))
check('notes call out grouped promotions', imported.notes.some((n) => /Acme/.test(n) && /tenure/i.test(n)))

check('name assembled', imported.resume.contact?.name === 'Jordan Reyes', imported.resume.contact?.name)
check('headline read', imported.resume.contact?.headline === 'Engineering Manager, Platform')
check('primary email read', imported.resume.contact?.email === 'jordan@example.com', imported.resume.contact?.email)
check('github url routed to its own field', imported.resume.contact?.githubUrl === 'https://github.com/jreyes', imported.resume.contact?.githubUrl)
check('personal site excludes github', imported.resume.contact?.websiteUrl === 'https://jreyes.dev', imported.resume.contact?.websiteUrl)
check('education read', imported.resume.education?.[0].school === 'State University')
check('skills collapsed to one group', imported.resume.skills?.length === 1 && imported.resume.skills[0].items.includes('AWS'))

// ---------- Bare Positions.csv path ----------
console.log('\nBare CSV import')
const fromCsv = importFromPositionsCsv(positionsCsv)
check('csv path groups by company too', fromCsv.resume.companies?.length === 3, `got ${fromCsv.resume.companies?.length}`)
check('csv path normalizes dates', fromCsv.resume.companies?.[0].positions[0].startDate === 'Jan 2022')
let rejected = false
try {
  importFromPositionsCsv('Fruit,Color\napple,red')
} catch {
  rejected = true
}
check('rejects an unrelated csv', rejected)

// ---------- Description -> bullets ----------
console.log('\nDescription splitting')
const bulleted = descriptionToBullets('• Led 3 teams\n- Shipped X\n* Hired 9')
check('strips bullet glyphs', bulleted.length === 3 && bulleted[0] === 'Led 3 teams', JSON.stringify(bulleted))
const blob = descriptionToBullets(
  'Owned the platform organization and its roadmap across three product lines. ' +
    'Reduced deployment lead time from six days to four hours by rebuilding CI. ' +
    'Hired and onboarded nine engineers while holding attrition under five percent annually.',
)
check('splits long blob into sentences', blob.length === 3, `got ${blob.length}`)

// ---------- Pasted-text fallback ----------
console.log('\nPasted-text fallback')
const pasted = importFromPastedText(
  [
    'Senior Engineering Manager',
    'Acme Corp · Full-time',
    'Jan 2022 - Present · 3 yrs',
    'Seattle, WA',
    'Led three platform teams.',
    'Engineering Manager',
    'Acme Corp · Full-time',
    'Jan 2020 - Dec 2021 · 2 yrs',
    'Seattle, WA',
    'Senior Back-end Engineer',
    'Globex · Full-time',
    'Mar 2017 - Dec 2019 · 2 yrs 10 mos',
    'Austin, TX',
  ].join('\n'),
)
const pastedCompanies = pasted.resume.companies ?? []
check('finds 2 companies', pastedCompanies.length === 2, `got ${pastedCompanies.length}`)
check('groups both Acme roles', pastedCompanies[0].positions.length === 2, `got ${pastedCompanies[0].positions.length}`)
check('title parsed', pastedCompanies[0].positions[0].title === 'Senior Engineering Manager', pastedCompanies[0].positions[0].title)
check('company parsed without suffix', pastedCompanies[0].name === 'Acme Corp', pastedCompanies[0].name)
check(
  'date range parsed',
  pastedCompanies[0].positions[0].startDate === 'Jan 2022' && pastedCompanies[0].positions[0].endDate === 'Present',
  `${pastedCompanies[0].positions[0].startDate}/${pastedCompanies[0].positions[0].endDate}`,
)
check('location parsed', pastedCompanies[0].location === 'Seattle, WA', pastedCompanies[0].location)
check('second company dates', pastedCompanies[1].positions[0].endDate === 'Dec 2019', pastedCompanies[1].positions[0].endDate)
check('pasted ic role gets a track', pastedCompanies[1].positions[0].track === 'ic', pastedCompanies[1].positions[0].track)

// ---------- Markdown ----------
console.log('\nMarkdown')
// Collapse the renderer's pretty-printing so the checks read as one line.
const md = (s: string) => renderMarkdown(s).replace(/\n\s*/g, '')
check('paragraph wrapped', md('Led three teams.') === '<p>Led three teams.</p>', md('Led three teams.'))
check('soft newline joins the line', md('Led three\nteams.') === '<p>Led three teams.</p>', md('Led three\nteams.'))
check('blank line splits paragraphs', md('One.\n\nTwo.') === '<p>One.</p><p>Two.</p>', md('One.\n\nTwo.'))
check('bold', md('a **b** c') === '<p>a <strong>b</strong> c</p>', md('a **b** c'))
check('italic with asterisks', md('a *b* c') === '<p>a <em>b</em> c</p>', md('a *b* c'))
check('italic with underscores', md('a _b_ c') === '<p>a <em>b</em> c</p>', md('a _b_ c'))
check('snake_case is not italic', md('run_the_job') === '<p>run_the_job</p>', md('run_the_job'))
check('bold nests italic', md('**a *b***') === '<p><strong>a <em>b</em></strong></p>', md('**a *b***'))
check('strikethrough', md('~~old~~') === '<p><del>old</del></p>', md('~~old~~'))
check('code span', md('use `npm run build`') === '<p>use <code>npm run build</code></p>', md('use `npm run build`'))
check('markers inside code stay literal', md('`a **b**`') === '<p><code>a **b**</code></p>', md('`a **b**`'))
check('escaped asterisk', md('5 \\* 3') === '<p>5 * 3</p>', md('5 \\* 3'))
check('lone asterisk is literal', md('2 * 3 = 6') === '<p>2 * 3 = 6</p>', md('2 * 3 = 6'))
check('bullet list', md('- a\n- b') === '<ul><li>a</li><li>b</li></ul>', md('- a\n- b'))
check('numbered list', md('1. a\n2. b') === '<ol><li>a</li><li>b</li></ol>', md('1. a\n2. b'))
check('nested list', md('- a\n  - b') === '<ul><li>a<ul><li>b</li></ul></li></ul>', md('- a\n  - b'))
check(
  'list follows a paragraph',
  md('Shipped:\n- a') === '<p>Shipped:</p><ul><li>a</li></ul>',
  md('Shipped:\n- a'),
)
check('list type switch starts a new list', md('- a\n1. b') === '<ul><li>a</li></ul><ol><li>b</li></ol>', md('- a\n1. b'))
check('blank input renders nothing', renderMarkdown('   \n  ') === '')

// Links: safe schemes only, everything else degrades to text.
check('link rendered', md('[site](https://x.dev)') === '<p><a href="https://x.dev">site</a></p>', md('[site](https://x.dev)'))
check('bare domain gets a scheme', md('[x](x.dev)').includes('href="https://x.dev"'), md('[x](x.dev)'))
check('email becomes mailto', md('[me](me@x.dev)').includes('href="mailto:me@x.dev"'), md('[me](me@x.dev)'))
check(
  'javascript url dropped, label kept',
  md('[click](javascript:alert(1))') === '<p>click</p>',
  md('[click](javascript:alert(1))'),
)
check('data url dropped', !md('[x](data:text/html;base64,aaa)').includes('<a '), md('[x](data:text/html;base64,aaa)'))
check('markdown escapes html', md('<b>x</b> & "y"') === '<p>&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;</p>', md('<b>x</b> & "y"'))
check('link label is escaped', !md('[<img src=x>](https://x.dev)').includes('<img'), md('[<img src=x>](https://x.dev)'))

// An achievement box yields sibling bullets, keeping sub-points nested.
const items = (s: string) => markdownBulletItems(s).map((i) => i.replace(/\n\s*/g, ''))
check('plain text is one bullet', items('Did a thing').join('|') === 'Did a thing', items('Did a thing').join('|'))
check('list becomes sibling bullets', items('- a\n- b').join('|') === 'a|b', items('- a\n- b').join('|'))
check('inline formatting inside a bullet', items('- cut **90%**')[0] === 'cut <strong>90%</strong>', items('- cut **90%**')[0])
check(
  'lead line keeps its sub-list nested',
  items('Rebuilt CI:\n  - a\n  - b')[0] === 'Rebuilt CI:<ul><li>a</li><li>b</li></ul>',
  items('Rebuilt CI:\n  - a\n  - b')[0],
)
check('nested sub-bullets under a list item', items('- a\n  - b')[0] === 'a<ul><li>b</li></ul>', items('- a\n  - b')[0])
check('blank box yields no bullets', markdownBulletItems('  \n ').length === 0)
check('bullet glyph rows are not double-counted', items('- a\n\n- b').length === 2, JSON.stringify(items('- a\n\n- b')))

// ---------- HTML render ----------
console.log('\nHTML render')
const resume = {
  ...emptyResume(),
  ...imported.resume,
  contact: {
    ...emptyResume().contact,
    ...imported.resume.contact,
    phone: '555-0100',
    linkedinUrl: 'linkedin.com/in/jreyes',
  },
  summary: 'Manager of managers with 9 years leading platform teams.',
}
resume.companies[0].positions[0].teamSize = '24'
resume.companies[0].positions[0].directReports = '4'
const html = renderResumeHtml(resume)
check('is a full document', html.startsWith('<!doctype html>') && html.trimEnd().endsWith('</html>'))
check('has no external requests', !/<(script|link)\b/i.test(html))
check('title includes name', html.includes('<title>Jordan Reyes — Resume</title>'))
check('renders all sections', ['Summary', 'Professional Experience', 'Core Competencies', 'Education'].every((s) => html.includes(s)))
check('company name is the heading', html.includes('class="company-name">Acme, Inc.<'))
check('derived tenure rendered', html.includes('Jan 2020 – Present'))
check('tenure duration rendered', /company-meta[^>]*>[^<]*Seattle WA[\s\S]{0,80}yrs/.test(html))
check('both roles at the company render', html.includes('Senior Engineering Manager') && html.includes('>Engineering Manager<'))
check('promotion ladder marked up', html.includes('class="company has-promotions"'))
check('generated manager scope rendered', html.includes('24 engineers · 4 direct reports'))
check('generated ic scope rendered', html.includes('Back-end Engineering'))
check('per-role dates shown for a ladder', html.includes('Jan 2022 – Present'))

// A single-position company shouldn't repeat its dates on the role line.
const solo = { ...emptyResume(), companies: [{ ...blankCompany(), name: 'Initech', positions: [position({ title: 'Engineer', startDate: 'Jan 2020', endDate: 'Dec 2021' })] }] }
const soloHtml = renderResumeHtml(solo)
check('single role omits duplicate dates', !soloHtml.includes('class="role-dates"'), 'role-dates should be absent')
// The stylesheet always mentions .has-promotions, so assert on the class attribute.
check('single role omits ladder styling', soloHtml.includes('class="company"') && !soloHtml.includes('class="company has-promotions"'))

// Contact and links must be two separate lines.
check('contact line has phone, email, address', /class="contact">[^<]*Seattle[\s\S]*?555-0100[\s\S]*?mailto:/.test(html))
check('links render on their own line', /class="links">[\s\S]*?linkedin\.com\/in\/jreyes/.test(html))
check('links line excludes the phone', !/class="links">[^<]*555-0100/.test(html))
check('bare linkedin url gets scheme', html.includes('href="https://linkedin.com/in/jreyes"'))
check('email is mailto', html.includes('href="mailto:jordan@example.com"'))
check('has print stylesheet', html.includes('@media print') && html.includes('@page'))

// A manual override must win over the generated line in the output.
const overridden = { ...emptyResume(), companies: [{ ...blankCompany(), name: 'Acme', positions: [position({ title: 'EM', track: 'manager', teamSize: '24', scope: 'Owned a $4M P&L' })] }] }
const overriddenHtml = renderResumeHtml(overridden)
check('override wins in output', overriddenHtml.includes('Owned a $4M P&amp;L') && !overriddenHtml.includes('24 engineers'))

// Markdown typed into the editor must survive into the document.
const formatted = {
  ...emptyResume(),
  summary: 'Led **platform** teams.\n\n- Owned CI/CD\n- Owned observability',
  companies: [
    {
      ...blankCompany(),
      name: 'Acme',
      positions: [
        position({
          title: 'EM',
          bullets: [
            'Rebuilt CI:\n  - cut lead time to *4 hours*\n  - doubled deploy frequency',
            '- Hired 9 engineers\n- Held attrition under 5%',
          ],
        }),
      ],
    },
  ],
}
const formattedHtml = renderResumeHtml(formatted)
check('summary bold rendered', formattedHtml.includes('<strong>platform</strong>'))
check('summary list rendered', /class="summary">[\s\S]*?<ul>[\s\S]*?Owned CI\/CD/.test(formattedHtml))
check('achievement sub-bullets nested', /<li>\s*Rebuilt CI:\s*<ul>/.test(formattedHtml), formattedHtml.slice(formattedHtml.indexOf('bullets'), formattedHtml.indexOf('bullets') + 240))
check('inline emphasis inside a bullet', formattedHtml.includes('<em>4 hours</em>'))
check(
  'one box can produce two bullets',
  formattedHtml.includes('<li>Hired 9 engineers</li>') && formattedHtml.includes('<li>Held attrition under 5%</li>'),
)

// XSS: injected markup must be escaped, not live.
const nasty = { ...emptyResume() }
nasty.contact.name = '<script>alert(1)</script>'
nasty.summary = 'Cut costs by 20% & <b>grew</b> team "fast"'
nasty.companies = [
  { ...blankCompany(), name: '<img src=x onerror=alert(1)>', positions: [position({ title: '"><script>bad()</script>', scope: '<b>24</b> engineers' })] },
]
const nastyHtml = renderResumeHtml(nasty)
check('escapes injected script tag', !nastyHtml.includes('<script>alert(1)</script>') && nastyHtml.includes('&lt;script&gt;'))
check('escapes ampersand and quotes', nastyHtml.includes('20% &amp; &lt;b&gt;grew&lt;/b&gt; team &quot;fast&quot;'))
check('escapes company and scope fields', !nastyHtml.includes('<img src=x') && !nastyHtml.includes('<script>bad()'))

// Empty resume must still produce a valid document, not throw.
const empty = renderResumeHtml(emptyResume())
check('empty resume renders', empty.includes('<title>Resume — Resume</title>') && !empty.includes('Professional Experience'))
check('empty resume omits blank contact lines', !empty.includes('class="contact"') && !empty.includes('class="links"'))

// ---------- Storage: v1 saves must survive the move to company grouping ----------
console.log('\nStorage migration')
installLocalStorageStub()
const { loadResume, saveResume, clearResume } = await import('../src/lib/storage')

// A v1 save: flat positions, each carrying its own company name and scope text.
localStorage.setItem(
  'resume-builder:v1',
  JSON.stringify({
    contact: { name: 'Jordan Reyes', email: 'jordan@example.com' },
    summary: 'Old summary.',
    positions: [
      { id: 'p1', company: 'Acme, Inc.', title: 'Senior EM', location: 'Seattle, WA', startDate: 'Jan 2022', endDate: 'Present', scope: '3 teams · 24 engineers', bullets: ['Did a thing'] },
      { id: 'p2', company: 'Acme Inc', title: 'EM', location: '', startDate: 'Jan 2020', endDate: 'Dec 2021', scope: '', bullets: [] },
      { id: 'p3', company: 'Globex', title: 'Engineer', location: 'Austin, TX', startDate: 'Mar 2017', endDate: 'Dec 2019', scope: '', bullets: [] },
    ],
  }),
)
const migrated = loadResume()
check('v1 contact preserved', migrated.contact.name === 'Jordan Reyes')
check('v1 summary preserved', migrated.summary === 'Old summary.')
check('v1 positions became companies', migrated.companies.length === 2, `got ${migrated.companies.length}`)
check('v1 same-company roles grouped', migrated.companies[0].positions.length === 2, `got ${migrated.companies[0].positions.length}`)
check('v1 company name lifted', migrated.companies[0].name === 'Acme, Inc.', migrated.companies[0].name)
check('v1 company location lifted', migrated.companies[0].location === 'Seattle, WA', migrated.companies[0].location)
check('v1 free-text scope kept as override', migrated.companies[0].positions[0].scope === '3 teams · 24 engineers')
check('v1 bullets kept', migrated.companies[0].positions[0].bullets[0] === 'Did a thing')
check('migrated positions get new fields', migrated.companies[0].positions.every((p) => p.track === 'manager' && Array.isArray(p.focus)))
check('migrated positions drop the company key', !('company' in migrated.companies[0].positions[0]))
check('v1 tenure now derivable', companyTenure(migrated.companies[0].positions).range === 'Jan 2020 – Present')

// Current-shape round trip, and partial saves missing newer fields.
saveResume(resume)
check('round trip keeps companies', loadResume().companies.length === resume.companies.length)
localStorage.setItem('resume-builder:v1', JSON.stringify({ companies: [{ name: 'Sparse Co', positions: [{ title: 'Dev' }] }] }))
const sparse = loadResume()
check('sparse company gets an id', Boolean(sparse.companies[0].id))
check('sparse position gets defaults', sparse.companies[0].positions[0].track === 'manager' && sparse.companies[0].positions[0].bullets.length === 1)
check('sparse resume still renders', renderResumeHtml(sparse).includes('Sparse Co'))
localStorage.setItem('resume-builder:v1', '{not json')
check('corrupt save falls back to empty', loadResume().companies.length === 0)
clearResume()
check('clear removes the key', localStorage.getItem('resume-builder:v1') === null)

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
if (failures > 0) process.exit(1)

// --- helpers -------------------------------------------------------------

/** Minimal localStorage so the browser storage layer can be exercised in Node. */
function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  const stub: Storage = {
    get length() {
      return store.size
    },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
  }
  ;(globalThis as { localStorage?: Storage }).localStorage = stub
}

/** Build a minimal deflate ZIP so importFromZip is tested against real bytes. */
async function buildZip(files: Record<string, string>): Promise<ArrayBuffer> {
  const { deflateRawSync, crc32 } = await import('node:zlib')
  const enc = new TextEncoder()
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(enc.encode(content))
    const deflated = deflateRawSync(raw)
    const crc = crc32(raw)
    const nameBytes = Buffer.from(enc.encode(name))

    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(deflated.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    nameBytes.copy(local, 30)
    locals.push(local, deflated)

    const central = Buffer.alloc(46 + nameBytes.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(deflated.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBytes.copy(central, 46)
    centrals.push(central)

    offset += local.length + deflated.length
  }

  const centralBlob = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(centrals.length, 8)
  eocd.writeUInt16LE(centrals.length, 10)
  eocd.writeUInt32LE(centralBlob.length, 12)
  eocd.writeUInt32LE(offset, 16)

  const all = Buffer.concat([...locals, centralBlob, eocd])
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer
}
