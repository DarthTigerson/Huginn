import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force'
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force'
import type { GraphifyNode, GraphifyLink } from '@/types/graphify'

export interface PositionedNode extends GraphifyNode, SimulationNodeDatum {
  x: number
  y: number
}

export interface PositionedLink {
  source: PositionedNode
  target: PositionedNode
  link: GraphifyLink
}

const SIMULATION_TICKS = 300

export function computeGraphLayout(
  nodes: GraphifyNode[],
  links: GraphifyLink[],
  width: number,
  height: number
): { nodes: PositionedNode[]; links: PositionedLink[] } {
  if (nodes.length === 0) return { nodes: [], links: [] }

  const simNodes: PositionedNode[] = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const radius = Math.min(width, height) / 3
    return {
      ...node,
      x: width / 2 + radius * Math.cos(angle),
      y: height / 2 + radius * Math.sin(angle),
    }
  })

  const simLinks: SimulationLinkDatum<PositionedNode>[] = links.map((link) => ({
    source: link.source,
    target: link.target,
  }))

  const simulation = forceSimulation(simNodes)
    .force('link', forceLink<PositionedNode, SimulationLinkDatum<PositionedNode>>(simLinks).id((d) => d.id).distance(70))
    .force('charge', forceManyBody().strength(-200))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(18))
    .stop()

  for (let i = 0; i < SIMULATION_TICKS; i++) simulation.tick()

  const nodesById = new Map(simNodes.map((n) => [n.id, n]))
  const positionedLinks: PositionedLink[] = links.reduce<PositionedLink[]>((acc, link) => {
    const source = nodesById.get(link.source)
    const target = nodesById.get(link.target)
    if (source && target) acc.push({ source, target, link })
    return acc
  }, [])

  return { nodes: simNodes, links: positionedLinks }
}
