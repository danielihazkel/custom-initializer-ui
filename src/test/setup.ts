import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { invalidateCatalog } from '../hooks/catalogCache'
import { resetToasts } from '../toast'
import { resetLang } from '../i18n'

// Unmount any rendered hooks/components between tests so jsdom state doesn't leak — nor the
// session-wide catalog cache, which would hand one test's mocked responses to the next, nor the
// toast stack, which would show one test's toasts in the next.
afterEach(() => {
  cleanup()
  invalidateCatalog()
  resetToasts()
  resetLang()
})
