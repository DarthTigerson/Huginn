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
