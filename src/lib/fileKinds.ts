const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'avif', 'ico', 'svg',
])

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown'])

function extOf(name: string): string {
  const lower = name.toLowerCase()
  return lower.includes('.') ? lower.split('.').pop()! : ''
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(extOf(name))
}

export function isMarkdownFile(name: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extOf(name))
}

export function imageMimeType(name: string): string {
  const ext = extOf(name)
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'jpg') return 'image/jpeg'
  if (ext === 'ico') return 'image/x-icon'
  return `image/${ext}`
}
