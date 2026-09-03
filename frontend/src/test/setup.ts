import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Without vitest's global flag, RTL's automatic cleanup hook is not registered —
// unmounted trees would accumulate and duplicate landmarks/ids across tests.
afterEach(cleanup)


// jsdom implements no scrolling APIs; real browsers always do. The incident
// list's scroll-into-view sync is a no-op here.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {}
}