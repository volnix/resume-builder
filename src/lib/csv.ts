/**
 * RFC 4180 CSV parser. LinkedIn exports quote any field containing commas or
 * newlines and escape embedded quotes by doubling them, so we handle both.
 */
export function parseCsv(text: string): string[][] {
  // Strip UTF-8 BOM — present on several LinkedIn export files.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      // Consume CRLF as a single terminator.
      i += ch === '\r' && src[i + 1] === '\n' ? 2 : 1
      continue
    }
    field += ch
    i++
  }

  // Flush trailing field/row unless the file ended on a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Turn a CSV into objects keyed by trimmed header name. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''))
  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {}
    headers.forEach((h, idx) => {
      rec[h] = (r[idx] ?? '').trim()
    })
    return rec
  })
}

/** Case/spacing-insensitive column lookup — LinkedIn renames headers over time. */
export function pick(rec: Record<string, string>, ...names: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const name of names) {
    const target = norm(name)
    for (const key of Object.keys(rec)) {
      if (norm(key) === target && rec[key]) return rec[key]
    }
  }
  return ''
}
