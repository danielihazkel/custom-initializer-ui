// @vitest-environment node
import { describe, expect, it } from 'vitest'
// The sync script is plain ESM without types; `status()` says, per shared file, whether the
// backend source is there and whether the checked-in copy equals it.
// @ts-expect-error — no declaration file for the script
import { status } from '../../../../scripts/sync-backend-fixtures.mjs'

interface FileStatus { name: string; available: boolean; upToDate: boolean }

/**
 * The schema document and the examples fixture are copies of files in the sibling `../backend`
 * repository. When that repository is checked out beside this one — the working layout — the
 * copies must equal their sources; `npm run sync:schema` rewrites them. Without it (a UI-only
 * checkout) there is nothing to compare with, and the copies are trusted as committed.
 */
describe('files shared with the backend', () => {
  for (const file of status() as FileStatus[]) {
    it.skipIf(!file.available)(`${file.name} is the backend's (npm run sync:schema)`, () => {
      expect(file.upToDate).toBe(true)
    })
  }
})
