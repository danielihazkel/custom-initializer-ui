// Finds every text the site translates: the literal arguments of `t(…)`, `tn(n, …, …)` and
// `tc(context, …)` in each source file that imports them from `src/i18n`. Used by
// `src/i18n/coverage.test.ts` (run alone by `npm run i18n:check`), which compares the result with
// the Hebrew dictionary.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CONTEXT_SEPARATOR = '\u0004'
export const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*)['"]/g
const I18N_PATH_RE = /(^|\/)i18n(\/index)?$/
const CALL_RE = /(?<![\w$.])(tn|tc|t)\(/g

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (path.split(sep).slice(-2).join('/') === 'i18n/he') continue
      out.push(...sourceFiles(path))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(path)
    }
  }
  return out
}

/** The names a file imports from the i18n module (only `t`, `tn`, `tc` matter). */
function importedNames(code) {
  const names = new Set()
  for (const m of code.matchAll(IMPORT_RE)) {
    if (!I18N_PATH_RE.test(m[2])) continue
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name === 't' || name === 'tn' || name === 'tc') names.add(name)
    }
  }
  return names
}

function skipSpace(code, i) {
  while (i < code.length && /\s/.test(code[i])) i++
  return i
}

/** A string literal at `i`: its value and the index after it, or null when it is not one. */
function literalAt(code, i) {
  const quote = code[i]
  if (quote !== "'" && quote !== '"' && quote !== '`') return null
  let j = i + 1
  while (j < code.length && code[j] !== quote) {
    if (code[j] === '\\') j++
    else if (quote === '`' && code[j] === '$' && code[j + 1] === '{') return null
    else if (quote !== '`' && code[j] === '\n') return null
    j++
  }
  if (j >= code.length) return null
  // Our own source's literal, decoded the way the compiler will.
  const value = new Function(`return ${code.slice(i, j + 1)}`)()
  return { value, end: j + 1 }
}

/** Skips one argument expression (to the comma or closing paren at depth 0). */
function skipArgument(code, i) {
  let depth = 0
  while (i < code.length) {
    const c = code[i]
    if (c === "'" || c === '"' || c === '`') {
      const lit = literalAt(code, i)
      if (lit) { i = lit.end; continue }
      const close = code.indexOf(c, i + 1) // a `${}` template: to its end, roughly
      i = close < 0 ? code.length : close + 1
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return i
      depth--
    } else if (c === ',' && depth === 0) return i
    i++
  }
  return i
}

function lineOf(code, i) {
  let line = 1
  for (let k = 0; k < i; k++) if (code[k] === '\n') line++
  return line
}

function inComment(code, i) {
  const head = code.slice(code.lastIndexOf('\n', i) + 1, i).trim()
  return head.startsWith('//') || head.startsWith('*') || head.startsWith('/*')
}

/**
 * Every translated text under `srcDir`: `{ keys: Map<key, [where]>, problems: [{where, message}] }`.
 * A key is the English text, or `context + "\u0004" + text` for `tc`.
 */
export function extract(srcDir = SRC_DIR) {
  const keys = new Map()
  const problems = []
  const add = (key, where) => {
    if (!keys.has(key)) keys.set(key, [])
    keys.get(key).push(where)
  }
  for (const file of sourceFiles(srcDir)) {
    const code = readFileSync(file, 'utf8')
    const names = importedNames(code)
    if (names.size === 0) continue
    const rel = relative(srcDir, file).split(sep).join('/')
    for (const m of code.matchAll(CALL_RE)) {
      const fn = m[1]
      if (!names.has(fn) || inComment(code, m.index)) continue
      const where = `${rel}:${lineOf(code, m.index)}`
      let i = skipSpace(code, m.index + m[0].length)
      if (fn === 'tn') {
        i = skipArgument(code, i)
        if (code[i] !== ',') { problems.push({ where, message: 'tn() needs a count and two literal texts' }); continue }
        i = skipSpace(code, i + 1)
      }
      const literals = []
      const count = fn === 't' ? 1 : 2
      let ok = true
      for (let n = 0; n < count && ok; n++) {
        const lit = literalAt(code, i)
        if (!lit) { ok = false; break }
        literals.push(lit.value)
        i = skipSpace(code, lit.end)
        if (n < count - 1) {
          if (code[i] !== ',') ok = false
          else i = skipSpace(code, i + 1)
        }
      }
      if (!ok) {
        problems.push({ where, message: `${fn}() takes literal text (no variables, no \${} templates)` })
        continue
      }
      if (fn === 't') add(literals[0], where)
      else if (fn === 'tn') { add(literals[0], where); add(literals[1], where) }
      else add(literals[0] + CONTEXT_SEPARATOR + literals[1], where)
    }
  }
  return { keys, problems }
}

/** The `{name}` placeholders of a text, sorted. */
export function placeholders(text) {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort()
}

// `node scripts/i18n-extract.mjs`: what is translated, as JSON (key → where).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { keys, problems } = extract()
  console.log(JSON.stringify({ problems, keys: Object.fromEntries(keys) }, null, 2))
}
