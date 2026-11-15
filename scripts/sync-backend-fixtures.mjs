// Refreshes the two files the editor shares with the backend, from the sibling ../backend repo:
//
//   src/components/fullstack/schema/fullstack-schema.json
//       a copy of backend/src/test/resources/golden/fullstack-schema.json — what
//       GET /metadata/fullstack/schema answers (FullstackSchemaTest pins it there). The editor's
//       limits, name rules and reserved names are read from this copy.
//   src/components/fullstack/__fixtures__/fullstack-examples.json
//       the seeded examples (backend catalog/fullstack-examples.json) in the shape
//       GET /metadata/fullstack/examples answers: `exampleId` as `id`, no `sortOrder`/`enabled`.
//
// npm run sync:schema          rewrite both
// npm run sync:schema -- --check   exit 1 when either is out of date (what fixturesInSync.test.ts asserts)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ui = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backend = resolve(ui, '..', 'backend')

export const FILES = [
  {
    name: 'schema',
    source: resolve(backend, 'src/test/resources/golden/fullstack-schema.json'),
    target: resolve(ui, 'src/components/fullstack/schema/fullstack-schema.json'),
    transform: value => value,
  },
  {
    name: 'examples',
    source: resolve(backend, 'src/main/resources/catalog/fullstack-examples.json'),
    target: resolve(ui, 'src/components/fullstack/__fixtures__/fullstack-examples.json'),
    // eslint-disable-next-line no-unused-vars
    transform: value => value.map(({ exampleId, sortOrder, enabled, ...rest }) => ({ id: exampleId, ...rest })),
  },
]

const read = path => JSON.parse(readFileSync(path, 'utf8'))

/** What the target should hold, or null when the backend repo is not checked out beside this one. */
export function expected(file) {
  return existsSync(file.source) ? file.transform(read(file.source)) : null
}

/** Per shared file: whether the backend source is there to compare with, and whether the copy equals it. */
export function status() {
  return FILES.map(file => {
    const want = expected(file)
    return {
      name: file.name,
      available: want !== null,
      upToDate: want !== null && existsSync(file.target) && JSON.stringify(read(file.target)) === JSON.stringify(want),
    }
  })
}

function main() {
  const check = process.argv.includes('--check')
  let stale = 0
  for (const file of FILES) {
    const want = expected(file)
    if (want === null) {
      console.error(`${file.name}: ${file.source} not found — is ../backend checked out?`)
      process.exitCode = 1
      continue
    }
    const text = JSON.stringify(want, null, 2) + '\n'
    const same = existsSync(file.target) && JSON.stringify(read(file.target)) === JSON.stringify(want)
    if (same) {
      console.log(`${file.name}: up to date`)
    } else if (check) {
      console.error(`${file.name}: out of date — run npm run sync:schema`)
      stale++
    } else {
      writeFileSync(file.target, text)
      console.log(`${file.name}: written`)
    }
  }
  if (stale > 0) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
