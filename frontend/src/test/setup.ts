import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Without vitest's global flag, RTL's automatic cleanup hook is not registered —
// unmounted trees would accumulate and duplicate landmarks/ids across tests.
afterEach(cleanup)
