import { useMemo } from 'react'
import { computeGraphLayout, type PositionedNode } from './graphLayout'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'
import type { GraphifyGraph } from '@/types/graphify'

const WIDTH = 1200
const HEIGHT = 900
const NODE_RADIUS = 7

const COMMUNITY_COLORS = [
  '#f2b134', '#5fb3b3', '#e07a5f', '#81b29a',
  '#9d8df1', '#e5a5c4', '#6fa8dc', '#f4845f',
]

function colorForCommunity(community: number | undefined): string {
  if (community === undefined) return '#8a8a8a'
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length]
}

function strokeStyleForConfidence(confidence: string): { strokeDasharray?: string; opacity: number } {
  if (confidence === 'INFERRED') return { strokeDasharray: '4 3', opacity: 0.7 }
  if (confidence === 'AMBIGUOUS') return { strokeDasharray: '1 3', opacity: 0.5 }
  return { opacity: 0.9 }
}

async function openNode(node: PositionedNode, projectRoot: string | null): Promise<void> {
  if (!projectRoot) return
  const absolutePath = `${projectRoot}/${node.source_file}`
  const content = await window.api.readFile(absolutePath)
  useEditorStore.getState().openTab({ path: absolutePath, content, dirty: false })
}

export function GraphView({ graph }: { graph: GraphifyGraph }) {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const layout = useMemo(() => computeGraphLayout(graph.nodes, graph.links, WIDTH, HEIGHT), [graph])

  if (layout.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-fg-subtle">No nodes in this graph yet.</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-panel">
      <svg width={WIDTH} height={HEIGHT}>
        {layout.links.map((positionedLink, i) => {
          const style = strokeStyleForConfidence(positionedLink.link.confidence)
          return (
            <line
              key={i}
              x1={positionedLink.source.x}
              y1={positionedLink.source.y}
              x2={positionedLink.target.x}
              y2={positionedLink.target.y}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeDasharray={style.strokeDasharray}
              opacity={style.opacity}
            />
          )
        })}
        {layout.nodes.map((node) => (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            className="cursor-pointer"
            onClick={() => openNode(node, projectRoot)}
          >
            <circle r={NODE_RADIUS} fill={colorForCommunity(node.community)} />
            <text x={NODE_RADIUS + 4} y={4} fontSize={11} fill="var(--color-fg)">
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
