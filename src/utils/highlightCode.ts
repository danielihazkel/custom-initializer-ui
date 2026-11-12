import { classHighlighter, highlightTree } from '@lezer/highlight'
import { Language, LanguageSupport } from '@codemirror/language'
import type { Extension } from '@codemirror/state'

/** A stretch of one line: its text and, when the grammar names it, its `tok-*` class. */
export interface Token {
  text: string
  cls?: string
}

/** Past this size a file is shown uncoloured: parsing it twice per diff is not worth the wait. */
const MAX_HIGHLIGHT_CHARS = 200_000

function languageOf(extensions: Extension[]): Language | null {
  for (const ext of extensions) {
    if (ext instanceof LanguageSupport) return ext.language
    if (ext instanceof Language) return ext
  }
  return null
}

/**
 * `code` as lines of coloured tokens, for places that draw code without an editor — the diff
 * view, which shows two versions of a file side by side and line by line.
 *
 * The parser is the one CodeMirror already loaded for the file (`useLanguage` in
 * `lang-from-path.ts`), walked with `@lezer/highlight`'s `classHighlighter`, which names tokens
 * with stable `tok-keyword` / `tok-string` / … classes; `index.css` colours those for both
 * themes. No grammar (or a parser that throws): one plain token per line.
 */
export function tokenizeLines(code: string, extensions: Extension[]): Token[][] {
  const lines: Token[][] = [[]]
  const push = (text: string, cls?: string) => {
    const parts = text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines[lines.length - 1].push(cls ? { text: part, cls } : { text: part })
    })
  }

  const language = code.length <= MAX_HIGHLIGHT_CHARS ? languageOf(extensions) : null
  if (!language) {
    push(code)
    return lines
  }
  try {
    const tree = language.parser.parse(code)
    let at = 0
    highlightTree(tree, classHighlighter, (from, to, cls) => {
      if (from > at) push(code.slice(at, from))
      push(code.slice(from, to), cls)
      at = to
    })
    if (at < code.length) push(code.slice(at))
    return lines
  } catch {
    const plain: Token[][] = [[]]
    code.split('\n').forEach((line, i) => {
      if (i > 0) plain.push([])
      if (line) plain[plain.length - 1].push({ text: line })
    })
    return plain
  }
}
