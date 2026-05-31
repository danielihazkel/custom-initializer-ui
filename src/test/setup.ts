import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount any rendered hooks/components between tests so jsdom state doesn't leak.
afterEach(() => {
  cleanup()
})
