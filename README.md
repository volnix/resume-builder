# Resume Builder

A client-only resume builder for software engineers and engineering managers.
Import your LinkedIn work history, edit it, and download a print-ready standalone
HTML resume. No backend — everything lives in `localStorage` and nothing leaves
the browser.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle into dist/
npm run verify   # parser + renderer checks
```

> This project includes a local `.npmrc` pinning the public npm registry, so
> installs don't depend on an internal CodeArtifact token.

## Getting your LinkedIn data

LinkedIn provides no public API for reading a profile, and its pages block
cross-origin requests — so a purely client-side app **cannot** fetch a profile
from its URL. Use your own data export instead:

1. LinkedIn → **Settings & Privacy → Data Privacy → Get a copy of your data**
2. Choose *Download larger data archive* (or just tick **Positions**)
3. LinkedIn emails a `.zip` in roughly 10 minutes to 24 hours
4. Drop that `.zip` on the import panel

Files read from the archive: `Positions.csv`, `Profile.csv`, `Education.csv`,
`Skills.csv`, `Email Addresses.csv`. Everything is parsed in-browser; the ZIP is
never uploaded.

**Fallback:** if you don't want to wait for the export, expand the *paste your
Experience section* panel and paste the text straight off your profile page. That
path is heuristic — verify every field it produces.

## What the importer does and doesn't fill in

| Filled from LinkedIn | You write yourself |
|---|---|
| Companies, titles, locations, dates | Achievement bullets with metrics |
| Roles grouped per employer, tenure derived | Team size / direct reports, or IC focus areas |
| Track and focus areas guessed from the title | Summary, competency grouping |
| Name, headline, location, email, education, skills | |

LinkedIn exports contain no accomplishment or headcount data, so bullets and the
scope inputs are yours to fill in. Track and focus areas are inferred from job
titles — a guess worth checking, which the import notes call out.

## Experience by company

Experience is modelled as **companies, each holding the positions held there**, so
promotions read as advancement instead of as unrelated jobs:

```
ACME, INC.                                    Jan 2020 – Present
Seattle, WA • 6 yrs 8 mos
  │ Senior Engineering Manager                Jan 2022 – Present
  │ 24 engineers · 4 direct reports
  │   • Cut deploy lead time from 6 days to 4 hours.
  │ Engineering Manager                       Jan 2020 – Dec 2021
  │ 9 engineers · 9 direct reports
```

Overall tenure is **derived**, never typed: earliest start to latest end across
every position, inclusive of both months (so Jan–Dec is 12 months, matching how
LinkedIn counts). A role with a blank or `Present` end date runs to today. Per-role
dates only render when a company has more than one position, so single-role
companies don't print the same range twice.

## Scope lines

The scope line is the line under a job title. It's generated from structured
inputs per position, chosen by a **Manager / Individual contributor** radio:

- **Manager** — team size and direct reports produce `24 engineers · 4 direct reports`.
  Counts are free text, so `20+` works; singulars are handled (`1 engineer`).
- **Individual contributor** — up to **3** areas chosen from Fullstack Engineering,
  Back-end Engineering, Front-end Engineering, Project Management, and Team Lead,
  producing `Back-end Engineering · Team Lead`. The 4th checkbox disables itself.

Every position also has an **override** field; anything typed there replaces the
generated line, which is also how free-text scope lines from older saves survive.

## Markdown in the summary and achievements

The **Summary** box and every **Achievements** box accept Markdown, rendered into
the preview and the exported file:

| Write | Get |
|---|---|
| `**bold**`, `*italic*`, `` `code` ``, `~~struck~~` | bold, italic, monospace, struck through |
| `[platform guide](docs.acme.dev/platform)` | a link — a bare domain gets `https://`, a bare address gets `mailto:` |
| `- item` / `1. item` lines | bullet or numbered list |
| an indented `- item` under another item | a nested sub-bullet |
| a blank line | a new paragraph (a single newline is just a space, as in Markdown) |

One achievement box can hold a whole list: `- a` and `- b` in the same box render
as two sibling bullets, so pasting a block of bullets works. A lead-in line
followed directly by `- ` lines keeps them nested underneath it:

```
Rebuilt CI on ephemeral runners:
  - cut deploy lead time from 6 days to 4 hours
  - doubled deploy frequency
```

Headings, images, tables, blockquotes, and raw HTML are intentionally not
supported — they either don't belong in an ATS-safe resume or would break the
print layout. Anything else that looks like markup, including typed-in HTML, is
escaped and printed literally, and link targets are restricted to `http(s)`,
`mailto:`, and `tel:` so an exported file can never carry a live `javascript:`
URL.

## The resume format

- Conservative serif body with a sans-serif masthead; single accent color; ATS-safe
  linear structure with no tables, columns, or images
- Contact details (phone, email, address) and links (LinkedIn, GitHub, personal
  site) render as **two separate lines** so neither wraps awkwardly
- **Core Competencies** grouped into Leadership / Delivery / Technical / Business
  (a one-click preset seeds these), rather than a flat keyword dump
- US Letter with 0.5" margins, `page-break-inside: avoid` on each company block

Export is one self-contained `.html` file with inlined CSS and no scripts, so it
opens offline and prints identically anywhere. For a PDF, open it and use your
browser's **Print → Save as PDF**.

## Layout

```
src/
  types.ts               Resume data model (Company -> Position)
  App.tsx                Shell, autosave, live preview, download
  components/
    ImportPanel.tsx      ZIP/CSV drop zone + paste fallback
    Editor.tsx           Form editor for every section
  lib/
    zip.ts               Dependency-free ZIP reader (DecompressionStream)
    csv.ts               RFC 4180 CSV parser
    dates.ts             Month-key parsing, durations, company tenure
    scope.ts             Scope-line generation per track
    markdown.ts          Markdown subset renderer (summary + achievements)
    linkedin.ts          Export files -> Resume mapping, company grouping
    exportHtml.ts        Standalone HTML renderer
    storage.ts           localStorage persistence + v1 migration
scripts/verify.ts        Parser/markdown/renderer/tenure/storage checks (npm run verify)
```

## Notes

- Data is keyed under `resume-builder:v1` in `localStorage`. Clearing site data or
  using a different browser loses it — download the HTML to keep a copy.
- Saves written before experience was grouped by company are migrated on load:
  consecutive roles at the same employer become that company's ladder, and the old
  free-text scope line becomes the override. The storage key is unchanged, so the
  migration runs transparently.
- The ZIP reader supports stored and deflate entries (what LinkedIn emits), not
  ZIP64 or encrypted archives.
