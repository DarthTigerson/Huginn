import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { PROSE_CLASSES } from './proseClasses'

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
