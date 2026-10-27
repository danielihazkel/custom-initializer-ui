import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { invalidateCatalog } from '../hooks/catalogCache'

// Unmount any rendered hooks/components between tests so jsdom state doesn't leak — nor the
// session-wide catalog cache, which would hand one test's mocked responses to the next.
afterEach(() => {
  cleanup()
  invalidateCatalog()
})
