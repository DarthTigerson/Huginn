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

// Distance a link's endpoints settle at, in px (forceLink).
const LINK_DISTANCE = 70
// Repulsion strength between all node pairs, in px (forceManyBody); negative
// repels. Keeps dense clusters from collapsing into an unreadable blob.
const CHARGE_STRENGTH = -200
// Minimum center-to-center spacing forceCollide enforces between nodes, in px.
const COLLIDE_RADIUS = 18
// Divisor applied to min(width, height) to get the deterministic seed
// circle's radius — keeps the initial layout comfortably inside the canvas
// before the simulation relaxes it.
const SEED_RADIUS_DIVISOR = 3

export function computeGraphLayout(
  nodes: GraphifyNode[],
  links: GraphifyLink[],
  width: number,
  height: number
): { nodes: PositionedNode[]; links: PositionedLink[] } {
  if (nodes.length === 0) return { nodes: [], links: [] }

  const simNodes: PositionedNode[] = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const radius = Math.min(width, height) / SEED_RADIUS_DIVISOR
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
    .force('link', forceLink<PositionedNode, SimulationLinkDatum<PositionedNode>>(simLinks).id((d) => d.id).distance(LINK_DISTANCE))
    .force('charge', forceManyBody().strength(CHARGE_STRENGTH))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(COLLIDE_RADIUS))
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
