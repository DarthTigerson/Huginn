import { vi } from 'vitest'

// Set up a basic localStorage stub for the node environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  })
}
