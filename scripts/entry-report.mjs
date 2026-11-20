// What the entry chunk is made of: bytes per source module, from the build's source map.
//
//   node scripts/entry-report.mjs                 build into a scratch folder, report the entry chunk
//   node scripts/entry-report.mjs --top 60        more rows (default 40; 0 = every module)
//   node scripts/entry-report.mjs --dir <folder>  read a build made with `vite build --sourcemap`
//   node scripts/entry-report.mjs --chunk FullstackView   another chunk, by the start of its name
//   node scripts/entry-report.mjs --lines src/App.tsx       where in one module the bytes are
//   node scripts/entry-report.mjs --why src/utils/fuzzy.ts   who imports a module (static imports)
//
// Use it when `npm run build:check` says the entry chunk is over its budget: the table names the
// module that grew or arrived. A module is in the entry chunk because something first-paint
// imports it statically; `--why` walks those imports back to `src/main.tsx`.
//
// No dependency: the map's mappings are decoded here (base64 VLQ), and each stretch of the
// minified file is counted for the source its mapping names.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i < 0 ? fallback : process.argv[i + 1]
}

// ── the import graph (for --why) ─────────────────────────────────────────────

const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'"\n;]*?\sfrom\s+)?['"]([^'"]+)['"]/g

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(from), spec)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate
  }
  return null
}

/** Static imports reachable from main.tsx: module → the modules that import it. */
function staticImporters() {
  const importers = new Map()
  const seen = new Set()
  const queue = [join(root, 'src', 'main.tsx')]
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(IMPORT)) {
      // `import type { X } from` is skipped above; `import { type X }` alone still counts as an
      // edge here, which only makes the answer cautious.
      const target = resolveImport(file, m[1])
      if (!target) continue
      if (!importers.has(target)) importers.set(target, new Set())
      importers.get(target).add(file)
      queue.push(target)
    }
  }
  return importers
}

function why(target) {
  const wanted = resolve(root, target)
  const importers = staticImporters()
  if (!importers.has(wanted)) {
    console.log(`${target} is not reached by static imports from src/main.tsx.`)
    return
  }
  // Shortest chain back to main.tsx, breadth first.
  const main = join(root, 'src', 'main.tsx')
  const via = new Map([[wanted, null]])
  const queue = [wanted]
  while (queue.length) {
    const file = queue.shift()
    if (file === main) break
    for (const parent of importers.get(file) ?? []) {
      if (!via.has(parent)) {
        via.set(parent, file)
        queue.push(parent)
      }
    }
  }
  const show = f => relative(root, f).replace(/\\/g, '/')
  console.log(`Imported by: ${[...importers.get(wanted)].map(show).sort().join(', ')}`)
  if (via.has(main)) {
    const chain = []
    for (let f = main; f; f = via.get(f)) chain.push(show(f))
    console.log(`Shortest chain: ${chain.join(' → ')}`)
  }
}

// ── the source map ───────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_VALUE = new Map([...B64].map((c, i) => [c, i]))

/** One line of `mappings` → [generatedColumn, sourceIndex | -1, sourceLine], the columns absolute. */
function decodeLine(line, state) {
  const segments = []
  let column = 0
  for (const part of line.split(',')) {
    if (!part) continue
    const fields = []
    let value = 0
    let shift = 0
    for (const ch of part) {
      const digit = B64_VALUE.get(ch)
      value += (digit & 31) << shift
      if (digit & 32) {
        shift += 5
      } else {
        fields.push(value & 1 ? -(value >> 1) : value >> 1)
        value = 0
        shift = 0
      }
    }
    column += fields[0]
    if (fields.length >= 4) {
      state.source += fields[1]
      state.line += fields[2]
      segments.push([column, state.source, state.line])
    } else {
      segments.push([column, -1, 0])
    }
  }
  return segments
}

function report(dir, chunkName, top, linesOf) {
  const assets = join(dir, 'assets')
  let file
  if (chunkName) {
    file = readdirSync(assets).find(f => f.startsWith(chunkName) && f.endsWith('.js'))
  } else {
    const html = readFileSync(join(dir, 'index.html'), 'utf8')
    file = /<script[^>]+src="\/assets\/(index-[^"]+\.js)"/.exec(html)?.[1]
  }
  if (!file) {
    console.error(chunkName ? `No chunk starting with "${chunkName}" in ${assets}.` : 'No entry chunk in index.html.')
    process.exit(2)
  }
  const mapFile = join(assets, `${file}.map`)
  if (!existsSync(mapFile)) {
    console.error(`${file} has no source map — build with \`vite build --sourcemap\`.`)
    process.exit(2)
  }
  const code = readFileSync(join(assets, file), 'utf8').replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n')
  const map = JSON.parse(readFileSync(mapFile, 'utf8'))

  const bytes = new Array(map.sources.length).fill(0)
  let unmapped = 0
  const state = { source: 0, line: 0 }
  // For --lines: bytes per stretch of LINE_BUCKET source lines of one module.
  const LINE_BUCKET = 25
  const buckets = new Map()
  const lines = code.split('\n')
  const mappingLines = map.mappings.split(';')
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]
    const segments = decodeLine(mappingLines[i] ?? '', state)
    const newline = i < lines.length - 1 ? 1 : 0
    if (!segments.length) {
      unmapped += Buffer.byteLength(text) + newline
      continue
    }
    unmapped += Buffer.byteLength(text.slice(0, segments[0][0]))
    for (let s = 0; s < segments.length; s++) {
      const [from, source, sourceLine] = segments[s]
      const to = s + 1 < segments.length ? segments[s + 1][0] : text.length
      const n = Buffer.byteLength(text.slice(from, to)) + (s + 1 === segments.length ? newline : 0)
      if (source < 0) unmapped += n
      else {
        bytes[source] += n
        if (linesOf) {
          const key = `${source}:${Math.floor(sourceLine / LINE_BUCKET)}`
          buckets.set(key, (buckets.get(key) ?? 0) + n)
        }
      }
    }
  }

  const name = source => {
    const abs = resolve(assets, source)
    const rel = relative(root, abs).replace(/\\/g, '/')
    return rel.startsWith('..') ? source.replace(/^(\.\.\/)+/, '') : rel
  }
  const rows = map.sources
    .map((source, i) => ({ name: name(source), bytes: bytes[i] }))
    .filter(r => r.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
  const total = Buffer.byteLength(code)

  if (linesOf) {
    const wanted = linesOf.split('\\').join('/')
    const index = map.sources.findIndex(source => name(source) === wanted)
    if (index < 0 || !bytes[index]) {
      console.log(`${wanted} is not in ${file}.`)
      return
    }
    console.log(`${wanted} in ${file}: ${bytes[index]} bytes, by source line`)
    const mine = [...buckets].filter(([key]) => key.startsWith(`${index}:`))
      .map(([key, n]) => [Number(key.split(':')[1]), n]).sort((a, b) => a[0] - b[0])
    for (const [bucket, n] of mine) {
      const from = bucket * LINE_BUCKET + 1
      console.log(`  ${String(from).padStart(5)}–${String(from + LINE_BUCKET - 1).padEnd(5)} ${String(n).padStart(6)}  ${'#'.repeat(Math.round(n / 60))}`)
    }
    return
  }

  console.log(`${file}: ${total} bytes, ${rows.length} modules`)
  const shown = top > 0 ? rows.slice(0, top) : rows
  for (const r of shown) {
    console.log(`  ${String(r.bytes).padStart(7)}  ${((r.bytes / total) * 100).toFixed(1).padStart(5)}%  ${r.name}`)
  }
  if (shown.length < rows.length) {
    const rest = rows.slice(shown.length).reduce((sum, r) => sum + r.bytes, 0)
    console.log(`  ${String(rest).padStart(7)}  ${((rest / total) * 100).toFixed(1).padStart(5)}%  (${rows.length - shown.length} more modules)`)
  }
  console.log(`  ${String(unmapped).padStart(7)}  ${((unmapped / total) * 100).toFixed(1).padStart(5)}%  (chunk glue: imports, exports, what no source is named for)`)

  // By folder, which is how a budget is argued about.
  const folders = new Map()
  for (const r of rows) {
    const parts = r.name.split('/')
    const key = r.name.startsWith('node_modules/')
      ? parts.slice(0, parts[1]?.startsWith('@') ? 3 : 2).join('/')
      : parts.slice(0, Math.min(parts.length - 1, 3)).join('/') || '.'
    folders.set(key, (folders.get(key) ?? 0) + r.bytes)
  }
  console.log('\nBy folder')
  for (const [key, n] of [...folders].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(7)}  ${key}`)
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

const target = arg('why')
if (target) {
  why(target)
} else {
  const top = Number(arg('top', '40'))
  const given = arg('dir')
  if (given) {
    report(resolve(given), arg('chunk'), top, arg('lines'))
  } else {
    const scratch = mkdtempSync(join(tmpdir(), 'entry-report-'))
    try {
      execFileSync(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build',
        '--sourcemap', '--outDir', scratch, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, stdio: 'inherit' })
      report(scratch, arg('chunk'), top, arg('lines'))
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }
}
