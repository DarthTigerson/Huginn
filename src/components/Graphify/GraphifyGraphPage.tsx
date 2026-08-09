import { useGraphifyStore } from '@/stores/graphifyStore'
import { GraphView } from './GraphView'

// Tab-content wrapper for the Graphify graph tab, mirroring GitGraphPage's
// role for the git graph tab: reads state straight from the store (rather
// than props) so opening the tab always reflects whatever loadGraph() most
// recently loaded for the current project.
export function GraphifyGraphPage() {
  const graph = useGraphifyStore((s) => s.graph)

  if (!graph) {
    return (
      <div className="h-full flex items-center justify-center bg-panel">
        <p className="text-sm text-fg-subtle">
          No graph yet — build one from the Graphify panel.
        </p>
      </div>
    )
  }

  return <GraphView graph={graph} />
}
