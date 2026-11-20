// Prints what the browser downloads before the Backend tab is usable, and fails the build when
// the entry chunk outgrows its budget. Run after `vite build` (see `npm run build:check`).
//
// The budget is the Round 11 rule: new surfaces (panels, tours, docks, sheets) are lazy chunks,
// so the entry may only grow by a few KB. Raise ENTRY_BUDGET deliberately, never to make a red
// build green.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * What the entry chunk may weigh, in bytes.
 *
 * History, so the number is not read as arbitrary: the round opened with a 235 KB entry, because
 * the Backend tab's update hook imported two helpers from `fullstack/updateBaseline` and dragged
 * the Fullstack layout engine into first paint. With that undone it was 104 610 bytes. The first
 * budget was that plus 8 KB; the picker's search, keyboard and palette wiring (phase 2) is
 * first-paint code and used it up, so the budget was re-based once, here, to leave the later
 * phases room for their glue — every panel, sheet, dock and tour itself is a lazy chunk.
 *
 * Hebrew (2026-11) raised it once, by its measured cost, from 120 000 to 120 500. The site's
 * language (`src/i18n/index.ts`: the lookup, the store, `setLang`/`initLang`) and the `t()` calls
 * in the Backend tab's first-paint code took the entry to 120 244 bytes. The dictionary itself is
 * a lazy chunk, fetched only in Hebrew.
 *
 * Round 14 lowered it, from 120 500 to 110 000. The entry had 60 bytes to spare, so every change
 * to first-paint code was a fight over bytes. What the Backend tab does not need in order to
 * paint moved to chunks of its own — the shell's ⌘K commands and tour start, the Generate
 * download, the wizards' drawers and palette entries, the notices over the selected
 * dependencies, the suggestions strip, the search's matcher and its empty state, the presets'
 * save prompt, the update baseline's reader, the toast stack's drawing — which took the entry
 * from 120 440 to about 103 600 bytes. The budget is that plus room for glue, not for features.
 *
 * A jump of tens of KB usually means another import like the first. `node scripts/entry-report.mjs`
 * lists the entry chunk's bytes per module (`--lines <module>` inside one, `--why <module>` for
 * who imports it).
 */
const ENTRY_BUDGET = 110_000

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const assets = join(dist, 'assets')

let html
try {
  html = readFileSync(join(dist, 'index.html'), 'utf8')
} catch {
  console.error('No dist/index.html — run `npm run build` first.')
  process.exit(2)
}

/** The file an attribute of index.html points at, by the chunk's name before the hash. */
function referenced(pattern) {
  const m = pattern.exec(html)
  return m ? m[1] : null
}

function size(file) {
  const bytes = readFileSync(join(assets, file))
  return { raw: bytes.length, gzip: gzipSync(bytes).length }
}

const kb = n => `${(n / 1024).toFixed(1).padStart(7)} KB`

const first = [
  ['entry', referenced(/<script[^>]+src="\/assets\/(index-[^"]+\.js)"/)],
  ['react', referenced(/href="\/assets\/(react-[^"]+\.js)"/)],
  ['motion', referenced(/href="\/assets\/(motion-[^"]+\.js)"/)],
  ['css', referenced(/href="\/assets\/(index-[^"]+\.css)"/)],
]

console.log('First paint (raw / gzip)')
let entryRaw = 0
for (const [label, file] of first) {
  if (!file) {
    console.log(`  ${label.padEnd(8)} not referenced by index.html`)
    continue
  }
  const s = size(file)
  if (label === 'entry') entryRaw = s.raw
  console.log(`  ${label.padEnd(8)}${kb(s.raw)} ${kb(s.gzip)}  ${file}`)
}

const lazy = readdirSync(assets)
  .filter(f => f.endsWith('.js') && !first.some(([, file]) => file === f))
  .map(f => ({ f, raw: statSync(join(assets, f)).size }))
  .sort((a, b) => b.raw - a.raw)
console.log(`\nLazy chunks: ${lazy.length}, largest:`)
for (const { f, raw } of lazy.slice(0, 8)) console.log(`  ${kb(raw)}  ${f}`)

if (!entryRaw) {
  console.error('\nCould not find the entry chunk in dist/index.html.')
  process.exit(2)
}
const over = entryRaw - ENTRY_BUDGET
if (over > 0) {
  console.error(`\nEntry chunk is ${kb(entryRaw).trim()} — ${over} bytes over its ${kb(ENTRY_BUDGET).trim()} budget.`)
  console.error('Move the new code behind lazy() instead of raising the budget.')
  process.exit(1)
}
console.log(`\nEntry chunk within budget (${-over} bytes to spare of ${kb(ENTRY_BUDGET).trim()}).`)
