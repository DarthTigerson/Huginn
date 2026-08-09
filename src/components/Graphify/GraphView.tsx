import { useMemo } from 'react'
import { computeGraphLayout, type PositionedNode } from './graphLayout'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'
import type { GraphifyGraph } from '@/types/graphify'

const WIDTH = 1200
const HEIGHT = 900
const NODE_RADIUS = 7

// Slack added around the tight bounding box of node positions, in px — needs
// to comfortably fit a node's circle plus its label text so nothing at the
// graph's edge gets clipped by the viewBox.
const VIEWBOX_PADDING = 60
// Floor for viewBox width/height so a single-node (or otherwise degenerate,
// zero-extent) graph doesn't collapse into a zero-sized/invalid viewBox.
const MIN_VIEWBOX_SIZE = 200

interface ViewBox {
  minX: number
  minY: number
  width: number
  height: number
}

function computeViewBox(nodes: PositionedNode[]): ViewBox {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, width: MIN_VIEWBOX_SIZE, height: MIN_VIEWBOX_SIZE }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x)
    maxY = Math.max(maxY, node.y)
  }

  minX -= VIEWBOX_PADDING
  minY -= VIEWBOX_PADDING
  maxX += VIEWBOX_PADDING
  maxY += VIEWBOX_PADDING

  const rawWidth = maxX - minX
  const rawHeight = maxY - minY
  const width = Math.max(rawWidth, MIN_VIEWBOX_SIZE)
  const height = Math.max(rawHeight, MIN_VIEWBOX_SIZE)
  // If we had to pad up to the minimum size, re-center the box on the
  // original midpoint rather than leaving the extra slack lopsided on one side.
  const centerX = minX + rawWidth / 2
  const centerY = minY + rawHeight / 2

  return {
    minX: centerX - width / 2,
    minY: centerY - height / 2,
    width,
    height,
  }
}

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
  const viewBox = useMemo(() => computeViewBox(layout.nodes), [layout.nodes])

  if (layout.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-fg-subtle">No nodes in this graph yet.</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-panel">
      <svg
        className="w-full h-full"
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
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
            onClick={() =>
              openNode(node, projectRoot).catch((err) => {
                console.warn(`[graphify] failed to open ${node.source_file}:`, err)
              })
            }
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
