import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GraphifyGraphPage } from '../GraphifyGraphPage'
import { useGraphifyStore } from '@/stores/graphifyStore'
import type { GraphifyGraph } from '@/types/graphify'

vi.mock('../GraphView', () => ({
  GraphView: ({ graph }: { graph: GraphifyGraph }) => (
    <div data-testid="graph-view">{graph.nodes.length} nodes</div>
  ),
}))

const sampleGraph: GraphifyGraph = {
  directed: false,
  multigraph: false,
  hyperedges: [],
  nodes: [
    { id: 'src_main', label: 'main.py', file_type: 'code', source_file: 'src/main.py', source_location: 'L1', _origin: 'ast' },
  ],
  links: [],
}

describe('GraphifyGraphPage', () => {
  beforeEach(() => {
    useGraphifyStore.setState({ graph: null })
  })

  it('renders GraphView when a graph is present in the store', () => {
    useGraphifyStore.setState({ graph: sampleGraph })
    render(<GraphifyGraphPage />)

    expect(screen.getByTestId('graph-view')).toBeInTheDocument()
    expect(screen.getByText('1 nodes')).toBeInTheDocument()
  })

  it('renders a "no graph yet" empty state when graph is null (e.g. a fresh project that was never built)', () => {
    render(<GraphifyGraphPage />)

    expect(screen.queryByTestId('graph-view')).not.toBeInTheDocument()
    expect(screen.getByText(/no graph yet/i)).toBeInTheDocument()
  })
})
