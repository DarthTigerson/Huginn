// src/types/graphify.ts

export interface GraphifyNode {
  id: string
  label: string
  file_type: string
  source_file: string
  source_location: string
  _origin: string
  _callable?: boolean
  community?: number
  community_name?: string
  norm_label?: string
}

export interface GraphifyLink {
  source: string
  target: string
  relation: string
  confidence: string
  confidence_score: number
  source_file: string
  source_location: string
  weight: number
  _origin: string
  context?: string
}

export interface GraphifyGraph {
  directed: boolean
  multigraph: boolean
  nodes: GraphifyNode[]
  links: GraphifyLink[]
  hyperedges: unknown[]
}
