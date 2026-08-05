const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i
const DOMAIN_RE = /^\S+\.\S+$/

// Enter in the URL bar: treat input with a scheme, or that looks like a bare
// domain (has a dot, no spaces), as a URL to load; anything else is a search.
export function normalizeUrlInput(raw: string): string {
  const input = raw.trim()
  if (!input) return ''
  if (SCHEME_RE.test(input)) return input
  if (DOMAIN_RE.test(input)) return `https://${input}`
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`
}
