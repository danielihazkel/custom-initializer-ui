/**
 * The small Markdown subset a content page is written in — a port of the backend's
 * ContentMarkdown, so the editor checks links and previews the page exactly as it will generate.
 *
 * Blocks, separated by blank lines: `#`/`##`/`###` headings, paragraphs, `-`/`*` bullet lists,
 * `1.` numbered lists, `>` callouts and a `---` rule. Inline: `**bold**`, `*em*`, `` `code` `` and
 * `[text](target)`, where the target is another page (`#/id` or `page:id`) or an `http(s)://` /
 * `mailto:` address. A marker without its closing half is plain text.
 */

export type ContentBlockKind = 'heading' | 'paragraph' | 'callout' | 'bullets' | 'numbers' | 'rule'
export type ContentRunKind = 'text' | 'bold' | 'em' | 'code' | 'page-link' | 'link'

/** One stretch of inline text; `target` is a page link's page id or a link's address. */
export interface ContentRun {
  kind: ContentRunKind
  text: string
  target?: string
}

/** `level` is a heading's 1–3; `items` one entry for a heading, paragraph or callout, one per list item. */
export interface ContentBlock {
  kind: ContentBlockKind
  level: number
  items: ContentRun[][]
}

const HEADING = /^(#{1,3})\s+(.*)$/
const BULLET = /^[-*]\s+(.*)$/
const NUMBERED = /^\d{1,3}[.)]\s+(.*)$/
const RULE = /^-{3,}$/
const PAGE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** The page a link target names (`#/orders` or `page:orders`), or undefined when it names none. */
export function pageIdOfLink(target: string): string | undefined {
  const id = target.startsWith('#/') ? target.slice(2) : /^page:/i.test(target) ? target.slice(5) : undefined
  return id != null && PAGE_ID.test(id) ? id : undefined
}

/** Whether a link target is an address the generated page may open: http(s) or mailto. */
export function isExternalLink(target: string): boolean {
  const lower = target.toLowerCase()
  if (lower.startsWith('https://')) return target.length > 8
  if (lower.startsWith('http://')) return target.length > 7
  return lower.startsWith('mailto:') && target.length > 7
}

export function parseInline(text: string): ContentRun[] {
  const runs: ContentRun[] = []
  let plain = ''
  const flush = () => {
    if (plain) runs.push({ kind: 'text', text: plain })
    plain = ''
  }
  let i = 0
  while (i < text.length) {
    const c = text[i]
    let end: number
    if (c === '`' && (end = text.indexOf('`', i + 1)) > i + 1) {
      flush()
      runs.push({ kind: 'code', text: text.slice(i + 1, end) })
      i = end + 1
    } else if (text.startsWith('**', i) && (end = text.indexOf('**', i + 2)) > i + 2) {
      flush()
      runs.push({ kind: 'bold', text: text.slice(i + 2, end) })
      i = end + 2
    } else if (c === '*' && (end = text.indexOf('*', i + 1)) > i + 1) {
      flush()
      runs.push({ kind: 'em', text: text.slice(i + 1, end) })
      i = end + 1
    } else if (c === '[' && (end = text.indexOf('](', i + 1)) > i + 1 && text.indexOf(')', end + 2) > end + 2) {
      const close = text.indexOf(')', end + 2)
      const label = text.slice(i + 1, end)
      const target = text.slice(end + 2, close).trim()
      flush()
      const page = pageIdOfLink(target)
      runs.push(page != null ? { kind: 'page-link', text: label, target: page } : { kind: 'link', text: label, target })
      i = close + 1
    } else {
      plain += c
      i++
    }
  }
  flush()
  return runs
}

export function parseContent(body: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  let paragraph: string[] = []
  let callout: string[] = []
  let items: ContentRun[][] = []
  let listKind: 'bullets' | 'numbers' | null = null
  for (const raw of lines) {
    const line = raw.trim()
    const bullet = BULLET.exec(line)
    const numbered = NUMBERED.exec(line)
    const itemKind = RULE.test(line) ? null : bullet ? 'bullets' : numbered ? 'numbers' : null
    // A block ends where a line of another kind (or a blank one) starts.
    if (listKind && itemKind !== listKind) {
      blocks.push({ kind: listKind, level: 0, items })
      items = []
      listKind = null
    }
    if (callout.length > 0 && !line.startsWith('>')) {
      blocks.push({ kind: 'callout', level: 0, items: [parseInline(callout.join(' '))] })
      callout = []
    }
    const paragraphLine = line !== '' && itemKind == null && !line.startsWith('>') && !HEADING.test(line) && !RULE.test(line)
    if (paragraph.length > 0 && !paragraphLine) {
      blocks.push({ kind: 'paragraph', level: 0, items: [parseInline(paragraph.join(' '))] })
      paragraph = []
    }
    if (line === '') continue
    const heading = HEADING.exec(line)
    if (heading) blocks.push({ kind: 'heading', level: heading[1].length, items: [parseInline(heading[2].trim())] })
    else if (RULE.test(line)) blocks.push({ kind: 'rule', level: 0, items: [] })
    else if (itemKind) {
      listKind = itemKind
      items.push(parseInline(((itemKind === 'bullets' ? bullet : numbered) as RegExpExecArray)[1].trim()))
    } else if (line.startsWith('>')) callout.push(line.slice(1).trim())
    else paragraph.push(line)
  }
  if (listKind) blocks.push({ kind: listKind, level: 0, items })
  if (callout.length > 0) blocks.push({ kind: 'callout', level: 0, items: [parseInline(callout.join(' '))] })
  if (paragraph.length > 0) blocks.push({ kind: 'paragraph', level: 0, items: [parseInline(paragraph.join(' '))] })
  return blocks
}

/** Every link in a body, with where it points — what the validator checks. */
export function contentLinks(body: string): ContentRun[] {
  return parseContent(body).flatMap(b => b.items.flat()).filter(r => r.kind === 'link' || r.kind === 'page-link')
}
