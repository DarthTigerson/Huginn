export function normalizeRef(ref: string): string {
  return ref.replace('HEAD -> ', '').replace('tag: ', '')
}

export interface RefTarget {
  name: string
  kind: 'local' | 'remote' | 'tag'
}

// A bare "HEAD" (detached, not on any branch or tag) is the only ref that
// isn't checkout-able. "HEAD -> <branch>" (the current branch) still
// resolves — git checkout of the branch you're already on is a harmless
// no-op — so the action stays available instead of silently disappearing
// for what's usually the single most prominent ref in the graph. Tags
// resolve too: checking one out is valid git (it just leaves you in
// detached HEAD), which is why the caller needs `kind` to word the menu
// action accurately rather than always saying "branch".
export function parseRefTarget(ref: string): RefTarget | null {
  if (ref === 'HEAD') return null
  if (ref.startsWith('tag: ')) return { name: ref.slice('tag: '.length), kind: 'tag' }
  const name = ref.startsWith('HEAD -> ') ? ref.slice('HEAD -> '.length) : ref
  if (name.startsWith('origin/')) {
    return { name: name.slice('origin/'.length), kind: 'remote' }
  }
  return { name, kind: 'local' }
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatExactDate(iso: string): string {
  const date = new Date(iso)
  const yyyy = date.getFullYear()
  const mm = padDatePart(date.getMonth() + 1)
  const dd = padDatePart(date.getDate())
  const hh = padDatePart(date.getHours())
  const min = padDatePart(date.getMinutes())
  const ss = padDatePart(date.getSeconds())
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
}

export function formatRelDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function refTone(ref: string): string {
  if (ref.includes('HEAD') || ref === 'main' || ref === 'master') {
    return 'border-[#2563eb]/80 bg-[#2563eb]/20 text-[var(--ref-blue-text)]'
  }
  if (ref.startsWith('origin/')) {
    return 'border-[#dc2626]/70 bg-[#dc2626]/20 text-[var(--ref-red-text)]'
  }
  if (ref.startsWith('tag: ')) {
    return 'border-[#facc15]/90 bg-[#facc15]/25 text-[var(--ref-yellow-text)]'
  }
  return 'border-[#16a34a]/70 bg-[#16a34a]/20 text-[var(--ref-green-text)]'
}

export function copyToClipboard(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  })
}
