/**
 * A tiny dependency-free renderer for the Markdown subset a resume actually
 * needs: paragraphs, bullet and numbered lists (nested), plus inline bold,
 * italic, strikethrough, code, and links. Headings, images, tables, and raw HTML
 * are deliberately unsupported — they don't belong in an ATS-safe resume, so any
 * markup typed in is escaped and printed as literal text.
 *
 * Everything is escaped before formatting is applied, so untrusted input can
 * never produce live markup, and link targets are limited to safe schemes.
 */

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** `- item`, `* item`, `+ item`, `1. item`, `1) item`. A space after the marker is required. */
const ITEM_RE = /^([ \t]*)(?:([-*+])|(\d{1,9})[.)])[ \t]+(.*)$/

interface Item {
  indent: number
  ordered: boolean
  content: string
}

/** Normalize line endings and expand tabs so indentation compares as spaces. */
const toLines = (src: string): string[] => src.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')

const indentOf = (line: string): number => line.length - line.trimStart().length

function matchItem(line: string): Item | null {
  const m = ITEM_RE.exec(line)
  if (!m) return null
  return { indent: m[1].length, ordered: m[2] === undefined, content: m[4] }
}

const isWordChar = (ch: string | undefined): boolean => ch !== undefined && /\w/.test(ch)

const count = (s: string, ch: string): number => s.split(ch).length - 1

/**
 * Only schemes that are safe in a standalone file are allowed through; anything
 * else (`javascript:`, `data:`, …) renders as plain text instead of a link.
 * Bare domains and emails get the scheme they obviously meant.
 */
function safeHref(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null
  if (/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(raw)) return `mailto:${raw}`
  if (/^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,})(\/|$|\?|#)/i.test(raw)) return `https://${raw}`
  return null
}

/** Inline formatting. Recurses so emphasis can nest, e.g. `**bold *and* italic**`. */
function inline(src: string): string {
  let out = ''
  let i = 0

  while (i < src.length) {
    const ch = src[i]
    const rest = src.slice(i)
    let m: RegExpExecArray | null

    // Backslash escape: print the next punctuation character literally.
    if (ch === '\\' && /^[\\`*_~[\]()#+\-.!]/.test(src.slice(i + 1))) {
      out += escapeHtml(src[i + 1])
      i += 2
      continue
    }

    // Code spans win over every other marker, so `**` inside them stays literal.
    if (ch === '`' && (m = /^(`+)([^`]+)\1/.exec(rest))) {
      out += `<code>${escapeHtml(m[2].trim())}</code>`
      i += m[0].length
      continue
    }

    // The URL may contain balanced parens, as in a Wikipedia link.
    if (ch === '[' && (m = /^\[([^\]]*)\]\(\s*([^\s()]*(?:\([^\s()]*\)[^\s()]*)*)\s*\)/.exec(rest))) {
      const href = safeHref(m[2])
      const label = inline(m[1]) || escapeHtml(m[2])
      out += href ? `<a href="${escapeHtml(href)}">${label}</a>` : label
      i += m[0].length
      continue
    }

    if ((ch === '*' || ch === '_') && (m = /^([*_])\1(?=\S)([\s\S]*?\S)\1\1/.exec(rest))) {
      // `**a *b***` closes with three markers: the lazy match stops one short, so
      // hand the leftover marker back to the italic still open inside.
      const spill = src[i + m[0].length] === ch && count(m[2], ch) % 2 === 1
      out += `<strong>${inline(spill ? m[2] + ch : m[2])}</strong>`
      i += m[0].length + (spill ? 1 : 0)
      continue
    }

    if (ch === '~' && (m = /^~~(?=\S)([\s\S]*?\S)~~/.exec(rest))) {
      out += `<del>${inline(m[1])}</del>`
      i += m[0].length
      continue
    }

    if ((ch === '*' || ch === '_') && (m = /^([*_])(?=\S)([\s\S]*?\S)\1/.exec(rest))) {
      // An underscore inside a word is part of the word (snake_case), not emphasis.
      const intraword = ch === '_' && (isWordChar(src[i - 1]) || isWordChar(src[i + m[0].length]))
      if (!intraword) {
        out += `<em>${inline(m[2])}</em>`
        i += m[0].length
        continue
      }
    }

    out += escapeHtml(ch)
    i += 1
  }

  return out
}

interface List {
  ordered: boolean
  /** Inner HTML of each item, without the `<li>` wrapper. */
  items: string[]
  /** Index of the first line after the list. */
  next: number
}

/** Consume one list starting at `start`, recursing for anything indented under an item. */
function takeList(lines: string[], start: number): List {
  const first = matchItem(lines[start])!
  const base = first.indent
  const { ordered } = first
  const items: string[] = []
  let current: string[] | null = null
  const flush = () => {
    if (current) {
      items.push(renderItem(current))
      current = null
    }
  }

  let i = start
  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      // A blank line ends the list unless what follows still belongs to it.
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j += 1
      if (j >= lines.length) break
      const after = matchItem(lines[j])
      const continues = indentOf(lines[j]) > base || (after !== null && after.indent >= base && after.ordered === ordered)
      if (!continues) break
      if (current) current.push('')
      i = j
      continue
    }

    const item = matchItem(line)
    if (item && item.indent <= base + 1) {
      // Switching between bullets and numbers starts a new list.
      if (item.ordered !== ordered) break
      flush()
      current = [item.content]
      i += 1
      continue
    }

    if (!current) break
    // Indented lines are the item's own blocks; unindented ones are lazy continuation.
    current.push(indentOf(line) > base ? line : line.trim())
    i += 1
  }

  flush()
  return { ordered, items, next: i }
}

/** An item's leading text is inline; anything after it is parsed as nested blocks. */
function renderItem(raw: string[]): string {
  const text: string[] = []
  let i = 0
  while (i < raw.length && raw[i].trim() && !matchItem(raw[i])) {
    text.push(raw[i].trim())
    i += 1
  }
  const head = inline(text.join(' '))
  const body = renderBlocks(raw.slice(i))
  if (!body) return head
  return head ? `${head}\n${body}` : body
}

const wrapList = (list: List): string => {
  const tag = list.ordered ? 'ol' : 'ul'
  return `<${tag}>\n${list.items.map((item) => listItem(item, '  ')).join('\n')}\n</${tag}>`
}

/** Keep the generated HTML readable: only nested content gets its own lines. */
export function listItem(inner: string, pad = ''): string {
  if (!inner.includes('\n')) return `${pad}<li>${inner}</li>`
  return `${pad}<li>\n${indentLines(inner, `${pad}  `)}\n${pad}</li>`
}

export const indentLines = (html: string, pad: string): string =>
  html
    .split('\n')
    .map((line) => (line ? pad + line : line))
    .join('\n')

function renderBlocks(lines: string[]): string {
  const out: string[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      flush()
      i += 1
      continue
    }
    if (matchItem(line)) {
      flush()
      const list = takeList(lines, i)
      out.push(wrapList(list))
      i = list.next
      continue
    }
    para.push(line.trim())
    i += 1
  }

  flush()
  return out.join('\n')
}

/** Render a block of Markdown to HTML. Returns '' for blank input. */
export function renderMarkdown(src: string): string {
  if (!src.trim()) return ''
  return renderBlocks(toLines(src))
}

/**
 * Render Markdown as the inner HTML of `<li>` items, for content that already
 * sits inside a list — an achievement box. Top-level list items become siblings
 * of the surrounding bullets, so `- a` / `- b` in one box yields two bullets
 * rather than a list inside a bullet. A line followed immediately by an indented
 * or unindented list keeps that list nested beneath it, which is how
 * "Rebuilt CI:" plus sub-points is meant to read.
 */
export function markdownBulletItems(src: string): string[] {
  const lines = toLines(src)
  const items: string[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) {
      items.push(inline(para.join(' ')))
      para = []
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      flush()
      i += 1
      continue
    }
    if (matchItem(line)) {
      const list = takeList(lines, i)
      if (para.length) {
        items.push(`${inline(para.join(' '))}\n${wrapList(list)}`)
        para = []
      } else {
        items.push(...list.items)
      }
      i = list.next
      continue
    }
    para.push(line.trim())
    i += 1
  }

  flush()
  return items.filter((item) => item.trim())
}
