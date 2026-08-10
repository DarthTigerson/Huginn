export function normalizeRef(ref: string): string {
  return ref.replace('HEAD -> ', '').replace('tag: ', '')
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
