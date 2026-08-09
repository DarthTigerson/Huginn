import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GraphifyPanel } from '../GraphifyPanel'
import { useGraphifyStore } from '@/stores/graphifyStore'

vi.mock('@/stores/fileStore', () => ({
  useFileStore: (selector: (s: { projectRoot: string | null }) => unknown) =>
    selector({ projectRoot: '/project' }),
}))
vi.mock('@/components/Viewer/MarkdownViewer', () => ({
  MarkdownViewer: ({ path }: { path: string }) => <div data-testid="markdown-viewer">{path}</div>,
}))
vi.mock('../GraphView', () => ({
  GraphView: () => <div data-testid="graph-view" />,
}))

function resetStore() {
  useGraphifyStore.setState({
    available: null, checking: false, running: false, progress: '', error: null,
    graph: null, loadingGraph: false,
    checkAvailable: vi.fn(),
    run: vi.fn(),
    loadGraph: vi.fn(),
  })
}

describe('GraphifyPanel', () => {
  beforeEach(() => {
    resetStore()
  })

  it('shows install instructions when graphify is not available', () => {
    useGraphifyStore.setState({ available: false })
    render(<GraphifyPanel />)
    expect(screen.getByText(/uv tool install graphifyy/)).toBeInTheDocument()
  })

  it('shows an empty state with a build button when available but no graph yet', () => {
    useGraphifyStore.setState({ available: true, graph: null })
    render(<GraphifyPanel />)
    expect(screen.getByRole('button', { name: /build graph/i })).toBeInTheDocument()
  })

  it('clicking build graph calls run with the project root', () => {
    const runMock = vi.fn()
    useGraphifyStore.setState({ available: true, graph: null, run: runMock })
    render(<GraphifyPanel />)
    fireEvent.click(screen.getByRole('button', { name: /build graph/i }))
    expect(runMock).toHaveBeenCalledWith('/project')
  })

  it('shows progress text while running', () => {
    useGraphifyStore.setState({ available: true, running: true, progress: 'extracting files...' })
    render(<GraphifyPanel />)
    expect(screen.getByText('extracting files...')).toBeInTheDocument()
  })

  it('shows an error message when the last run failed', () => {
    useGraphifyStore.setState({ available: true, error: 'graphify exited with code 1' })
    render(<GraphifyPanel />)
    expect(screen.getByText('graphify exited with code 1')).toBeInTheDocument()
  })

  it('renders the graph view by default once a graph is loaded, and switches to the report view on click', () => {
    useGraphifyStore.setState({
      available: true,
      graph: { directed: false, multigraph: false, nodes: [], links: [], hyperedges: [] },
    })
    render(<GraphifyPanel />)
    expect(screen.getByTestId('graph-view')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /report/i }))
    expect(screen.getByTestId('markdown-viewer')).toHaveTextContent('/project/graphify-out/GRAPH_REPORT.md')
  })
})
