import { DEFAULT_THEME, type ThemeId } from '../types'

export interface Theme {
  id: ThemeId
  name: string
  /** One line for the theme picker. */
  blurb: string
  /** Only a theme that opts in renders the uploaded headshot. */
  usesPhoto: boolean
  /** Appended after BASE_CSS in the exported document. */
  css: string
}

/**
 * Structure and layout shared by every theme: all three render the same markup,
 * so switching themes changes only the stylesheet. Colors, fonts, and sizes come
 * from custom properties that each theme sets, and nothing here loads an external
 * asset — the exported file has to work offline and print identically anywhere.
 */
const BASE_CSS = `  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background: #f4f4f5;
    color: var(--ink);
    font: var(--body-size)/var(--line) var(--body-font);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    max-width: 8.5in;
    min-height: 11in;
    margin: 0.4in auto;
    padding: 0.55in 0.65in;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,.14);
  }

  header.masthead { padding-bottom: 10px; }
  .masthead-inner { display: flex; align-items: center; gap: 20px; }
  .identity { flex: 1 1 auto; min-width: 0; }
  .photo {
    flex: 0 0 auto;
    width: 1.15in;
    height: 1.15in;
    border-radius: 50%;
    object-fit: cover;
  }
  h1 {
    margin: 0;
    font-family: var(--head-font);
    font-size: 22pt;
    font-weight: 700;
    color: var(--accent);
  }
  .headline {
    margin: 5px 0 0;
    font-family: var(--head-font);
    font-size: 11pt;
    font-weight: 600;
    color: var(--muted);
  }
  .contact, .links {
    margin: 6px 0 0;
    font-family: var(--head-font);
    font-size: 9pt;
    color: var(--muted);
  }
  .links { margin-top: 3px; }
  .contact a, .links a { color: var(--muted); text-decoration: none; }
  .contact a:hover, .links a:hover { text-decoration: underline; }
  .sep { padding: 0 .45em; color: var(--rule); }

  section { margin-top: 16px; }
  .section-title {
    margin: 0 0 8px;
    font-family: var(--head-font);
    font-size: 10.5pt;
    font-weight: 700;
    letter-spacing: .13em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .summary { margin: 0; }
  .summary p { margin: 0 0 6px; }
  .summary > :last-child { margin-bottom: 0; }
  .summary ul, .summary ol { margin: 4px 0 6px; padding-left: 17px; text-align: left; }
  .summary li { margin-bottom: 3px; }

  .company { margin-bottom: 14px; page-break-inside: avoid; }
  .company:last-child { margin-bottom: 0; }
  .company-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  .company-name {
    margin: 0;
    font-family: var(--head-font);
    font-size: 12pt;
    font-weight: 700;
  }
  .company-dates {
    flex: 0 0 auto;
    font-family: var(--head-font);
    font-size: 9.5pt;
    font-weight: 600;
    white-space: nowrap;
    color: var(--ink);
  }
  .company-meta {
    margin: 1px 0 0;
    font-size: 9pt;
    color: var(--muted);
  }

  .role { margin-top: 7px; page-break-inside: avoid; }
  /* Indent the ladder only when there are promotions to show. */
  .has-promotions .role {
    margin-left: 11px;
    padding-left: 10px;
    border-left: 1.5px solid var(--rule);
  }
  .role-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  .role-title {
    margin: 0;
    font-family: var(--body-font);
    font-size: 10.5pt;
    font-weight: 700;
  }
  .role-dates {
    flex: 0 0 auto;
    font-family: var(--head-font);
    font-size: 9pt;
    white-space: nowrap;
    color: var(--muted);
  }
  .role-scope {
    margin: 2px 0 0;
    font-family: var(--head-font);
    font-size: 9.5pt;
    color: var(--muted);
  }
  .bullets { margin: 4px 0 0; padding-left: 17px; }
  .bullets li { margin-bottom: 3px; }
  .bullets li:last-child { margin-bottom: 0; }
  /* Markdown nesting inside an achievement: sub-points and continuation text. */
  .bullets ul, .bullets ol { margin: 3px 0 0; padding-left: 16px; }
  .bullets ul { list-style-type: circle; }
  .bullets p { margin: 3px 0 0; }

  /* Inline Markdown, shared by the summary and the achievement bullets. */
  .summary code, .bullets code {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.9em;
  }
  .summary a, .bullets a { color: var(--accent); text-decoration: none; }
  .summary del, .bullets del { color: var(--muted); }

  .skills { display: grid; gap: 4px; }
  .skill-row { display: grid; grid-template-columns: 1.55in 1fr; gap: 8px; }
  .skill-label {
    font-family: var(--head-font);
    font-size: 9.5pt;
    font-weight: 700;
  }
  .skill-items { font-size: 10pt; }

  .edu {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 5px;
  }
  .edu-school {
    font-family: var(--head-font);
    font-size: 10.5pt;
    font-weight: 700;
  }
  .edu-degree::before { content: " — "; color: var(--muted); }
  .edu-degree { font-style: italic; color: var(--muted); font-size: 10pt; }

  @media print {
    body { background: #fff; }
    .page {
      margin: 0;
      max-width: none;
      min-height: 0;
      padding: 0;
      box-shadow: none;
    }
    a { color: var(--ink); }
    .section-title { page-break-after: avoid; }
  }
  @page { margin: 0.5in; size: letter; }`

const CLASSIC_CSS = `  :root {
    --ink: #1a1a1a;
    --muted: #4a4a4a;
    --rule: #c8c8c8;
    --accent: #1f3a5f;
    --body-font: "Georgia", "Times New Roman", serif;
    --head-font: "Helvetica Neue", Arial, sans-serif;
    --body-size: 10.5pt;
    --line: 1.45;
  }
  .masthead-inner { justify-content: center; }
  .identity { text-align: center; }
  h1 { letter-spacing: .06em; text-transform: uppercase; }
  .headline { letter-spacing: .04em; text-transform: uppercase; }
  .section-title { padding-bottom: 3px; border-bottom: 1.5px solid var(--accent); }
  .summary { text-align: justify; }
  .company-meta { font-style: italic; }
  .role-title { font-style: italic; }`

const MODERN_CSS = `  :root {
    --ink: #111827;
    --muted: #4b5563;
    --rule: #d6dbe1;
    --accent: #0f766e;
    --body-font: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
    --head-font: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
    --body-size: 10pt;
    --line: 1.5;
  }
  header.masthead { padding-bottom: 12px; border-bottom: 2px solid var(--accent); }
  .masthead-inner { justify-content: flex-start; }
  .identity { text-align: left; }
  h1 {
    font-size: 25pt;
    letter-spacing: -.015em;
    color: var(--ink);
  }
  .headline {
    margin-top: 3px;
    font-size: 10pt;
    letter-spacing: .11em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .contact, .links { font-size: 8.8pt; }

  section { margin-top: 18px; }
  /* A short accent bar under each section label is this theme's signature. */
  .section-title {
    position: relative;
    padding-bottom: 5px;
    font-size: 9pt;
    letter-spacing: .17em;
    border-bottom: 1px solid var(--rule);
  }
  .section-title::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: -1px;
    width: 46px;
    height: 2px;
    background: var(--accent);
  }

  .company { margin-bottom: 15px; }
  .company-name { font-size: 11.5pt; letter-spacing: -.005em; }
  .company-dates { font-weight: 500; font-variant-numeric: tabular-nums; color: var(--muted); }
  .company-meta {
    margin-top: 2px;
    font-size: 8.5pt;
    letter-spacing: .05em;
    text-transform: uppercase;
  }
  .role-title { font-weight: 600; font-size: 10.5pt; }
  .role-scope { color: var(--accent); font-weight: 500; }
  .bullets { padding-left: 15px; list-style-type: square; }
  .skill-label { letter-spacing: .04em; }`

const PORTRAIT_CSS = `  :root {
    --ink: #1f2933;
    --muted: #52606d;
    --rule: #cbd2d9;
    --accent: #334e68;
    --body-font: "Helvetica Neue", Helvetica, Arial, sans-serif;
    --head-font: "Helvetica Neue", Helvetica, Arial, sans-serif;
    --body-size: 10pt;
    --line: 1.48;
  }
  header.masthead { padding-bottom: 14px; }
  .masthead-inner { justify-content: flex-start; gap: 22px; }
  .identity { text-align: left; }
  .photo {
    width: 1.25in;
    height: 1.25in;
    border: 2px solid var(--rule);
  }
  h1 { font-size: 23pt; letter-spacing: .01em; color: var(--ink); }
  .headline {
    font-size: 10.5pt;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .contact, .links { font-size: 9pt; }

  .section-title {
    padding-bottom: 4px;
    font-size: 10pt;
    letter-spacing: .15em;
    border-bottom: 1px solid var(--rule);
  }
  .company-name { font-size: 12pt; }
  .company-meta { font-size: 9pt; letter-spacing: .02em; }
  .role-title { font-weight: 600; }
  .role-scope { font-weight: 500; }
  .bullets { padding-left: 16px; }
  .edu-school { font-size: 10.5pt; }`

export const THEMES: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Serif body, centered masthead, ruled section headings. The safest choice for ATS and conservative readers.',
    usesPhoto: false,
    css: CLASSIC_CSS,
  },
  {
    id: 'modern',
    name: 'Modern',
    blurb: 'All sans-serif, left-aligned name, teal accent bars under each section. Still single-column and text-only.',
    usesPhoto: false,
    css: MODERN_CSS,
  },
  {
    id: 'portrait',
    name: 'Portrait',
    blurb: 'Headshot beside your name, sans-serif body, slate accents. Use where a photo is expected — many US screeners prefer none.',
    usesPhoto: true,
    css: PORTRAIT_CSS,
  },
]

export const getTheme = (id: ThemeId | undefined): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME)!

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && THEMES.some((t) => t.id === value)

/** BASE_CSS plus the theme's own rules, in that order so themes can override. */
export const themeStylesheet = (id: ThemeId): string => `${BASE_CSS}\n\n${getTheme(id).css}`
