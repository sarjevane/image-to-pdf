import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

let objectUrlCount = 0

if (!URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => {
      objectUrlCount += 1
      return `blob:mock-${objectUrlCount}`
    }),
  })
}

if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
}

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID: vi.fn(() => `test-id-${Math.random().toString(36).slice(2)}`),
    },
  })
}
