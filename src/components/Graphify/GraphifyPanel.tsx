import { useEffect, useState } from 'react'
import { useGraphifyStore } from '@/stores/graphifyStore'
import { useFileStore } from '@/stores/fileStore'
import { MarkdownViewer } from '@/components/Viewer/MarkdownViewer'
import { GraphView } from './GraphView'

type PanelView = 'graph' | 'report'

export function GraphifyPanel() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const { available, checking, running, progress, error, graph, checkAvailable, run } = useGraphifyStore()
  const [view, setView] = useState<PanelView>('graph')

  useEffect(() => {
    if (available === null && !checking) checkAvailable()
  }, [available, checking, checkAvailable])

  if (available === false) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-fg mb-2">graphify isn't installed.</p>
          <p className="text-xs text-fg-subtle font-mono">uv tool install graphifyy && graphify install</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <button
          className={`text-xs px-2 py-1 rounded ${view === 'graph' ? 'bg-accent/20 text-accent' : 'text-fg-muted'}`}
          onClick={() => setView('graph')}
        >
          Graph
        </button>
        <button
          className={`text-xs px-2 py-1 rounded ${view === 'report' ? 'bg-accent/20 text-accent' : 'text-fg-muted'}`}
          onClick={() => setView('report')}
        >
          Report
        </button>
        <button
          className="ml-auto text-xs px-2 py-1 rounded bg-accent/20 text-accent disabled:opacity-40"
          disabled={!projectRoot || running}
          onClick={() => projectRoot && run(projectRoot)}
        >
          {graph ? 'Rebuild graph' : 'Build graph'}
        </button>
      </div>

      {running && (
        <div className="px-3 py-2 text-xs text-fg-muted font-mono whitespace-pre-wrap border-b border-border">
          {progress || 'Running graphify…'}
        </div>
      )}
      {error && !running && (
        <div className="px-3 py-2 text-xs text-red-400 border-b border-border">{error}</div>
      )}

      <div className="flex-1 min-h-0">
        {!graph ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-fg-subtle">No graph yet — build one to get started.</p>
          </div>
        ) : view === 'graph' ? (
          <GraphView graph={graph} />
        ) : (
          <MarkdownViewer path={`${projectRoot}/graphify-out/GRAPH_REPORT.md`} />
        )}
      </div>
    </div>
  )
}
