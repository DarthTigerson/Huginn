import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Guardrail for the browser-over-popups bug: Electron draws browser tabs
// above the whole app, so any popup that floats over the editor area must
// call useCoverNativeViews (src/lib/nativeViewCover.ts) or it opens hidden
// behind a browser page. This finds every component that renders a portal or
// a fixed full-window layer and fails if it doesn't. Add a file to ALLOWED
// only with a reason it can never overlap a browser tab.
const ALLOWED: Record<string, string> = {}

const ROOT = join(__dirname, '..', '..')
const POPUP = /createPortal\(|className="[^"]*\bfixed (inset-0|z-\[)/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

describe('popups cover browser tabs', () => {
  it('every full-window popup calls useCoverNativeViews', () => {
    const missing = walk(join(ROOT, 'components'))
      .filter((path) => {
        const source = readFileSync(path, 'utf8')
        return POPUP.test(source) && !source.includes('useCoverNativeViews(')
      })
      .map((path) => relative(ROOT, path))
      .filter((path) => !(path in ALLOWED))
    expect(missing).toEqual([])
  })
})
