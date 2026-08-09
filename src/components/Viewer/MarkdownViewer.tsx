import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

const PROSE_CLASSES = [
  'mx-auto max-w-3xl px-8 py-6 text-sm text-fg',
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2',
  '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2',
  '[&_p]:mb-3 [&_p]:leading-relaxed',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3',
  '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3',
  '[&_li]:mb-1',
  '[&_a]:text-accent [&_a]:underline',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-fg-muted [&_blockquote]:mb-3',
  '[&_code]:bg-white/10 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs',
  '[&_pre]:bg-white/5 [&_pre]:rounded [&_pre]:p-3 [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_table]:border-collapse [&_table]:mb-3',
  '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
  '[&_hr]:border-border [&_hr]:my-4',
  '[&_img]:max-w-full',
].join(' ')

export function MarkdownViewer({ path }: { path: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const name = path.split('/').pop() ?? path

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setError(false)
    window.api.readFile(path).then(
      (text) => { if (!cancelled) setContent(text) },
      () => { if (!cancelled) setError(true) }
    )
    return () => { cancelled = true }
  }, [path])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-fg-subtle">Couldn't load {name}</p>
      </div>
    )
  }

  if (content === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-fg-subtle">Loading…</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-panel">
      <div className={PROSE_CLASSES}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
