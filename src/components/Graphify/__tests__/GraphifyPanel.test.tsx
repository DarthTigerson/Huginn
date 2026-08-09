import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GraphifyPanel } from '../GraphifyPanel'
import { useGraphifyStore } from '@/stores/graphifyStore'
import { useEditorStore } from '@/stores/editorStore'
import { GRAPHIFY_GRAPH_TAB_PATH } from '@/components/Settings/paths'
import { buildMarkdownPreviewPath } from '@/components/Viewer/paths'

const { getProjectRoot, setProjectRoot } = vi.hoisted(() => {
  let projectRoot: string | null = '/project'
  return {
    getProjectRoot: () => projectRoot,
    setProjectRoot: (value: string | null) => {
      projectRoot = value
    },
  }
})

vi.mock('@/stores/fileStore', () => ({
  useFileStore: (selector: (s: { projectRoot: string | null }) => unknown) =>
    selector({ projectRoot: getProjectRoot() }),
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
  const openTabMock = vi.fn()

  beforeEach(() => {
    resetStore()
    openTabMock.mockClear()
    setProjectRoot('/project')
    useEditorStore.setState({ openTab: openTabMock })
  })

  it('shows install instructions when graphify is not available', () => {
    useGraphifyStore.setState({ available: false })
    render(<GraphifyPanel />)
    expect(screen.getByText(/uv tool install graphifyy/)).toBeInTheDocument()
  })

  it('shows a build button when available but no graph yet', () => {
    useGraphifyStore.setState({ available: true, graph: null })
    render(<GraphifyPanel />)
    expect(screen.getByRole('button', { name: /build graph/i })).toBeInTheDocument()
  })

  it('shows a rebuild button once a graph exists', () => {
    useGraphifyStore.setState({
      available: true,
      graph: { directed: false, multigraph: false, nodes: [], links: [], hyperedges: [] },
    })
    render(<GraphifyPanel />)
    expect(screen.getByRole('button', { name: /rebuild graph/i })).toBeInTheDocument()
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

  it('shows an error message (including folded stderr tail) when the last run failed', () => {
    useGraphifyStore.setState({
      available: true,
      error: 'graphify exited with code 1:\nTraceback (most recent call last):\nRuntimeError: boom',
    })
    render(<GraphifyPanel />)
    expect(screen.getByText(/RuntimeError: boom/)).toBeInTheDocument()
  })

  it('does not show the error banner while a new run is in progress', () => {
    useGraphifyStore.setState({ available: true, running: true, progress: 'working...', error: 'stale error' })
    render(<GraphifyPanel />)
    expect(screen.queryByText('stale error')).not.toBeInTheDocument()
  })

  it('"Open Graph" opens the graphify graph tab and reloads the graph for the current project', () => {
    const loadGraphMock = vi.fn()
    useGraphifyStore.setState({ available: true, loadGraph: loadGraphMock })
    render(<GraphifyPanel />)

    fireEvent.click(screen.getByRole('button', { name: /open graph/i }))

    expect(openTabMock).toHaveBeenCalledWith({ path: GRAPHIFY_GRAPH_TAB_PATH, content: '', dirty: false })
    expect(loadGraphMock).toHaveBeenCalledWith('/project')
  })

  it('"Open Report" opens the GRAPH_REPORT.md markdown-preview tab for the current project', () => {
    useGraphifyStore.setState({ available: true })
    render(<GraphifyPanel />)

    fireEvent.click(screen.getByRole('button', { name: /open report/i }))

    expect(openTabMock).toHaveBeenCalledWith({
      path: buildMarkdownPreviewPath('/project/graphify-out/GRAPH_REPORT.md'),
      content: '',
      dirty: false,
    })
  })

  it('auto-opens the Graph tab the moment a build finishes successfully', () => {
    useGraphifyStore.setState({ available: true, running: true, graph: null })
    render(<GraphifyPanel />)
    expect(openTabMock).not.toHaveBeenCalled()

    act(() => {
      useGraphifyStore.setState({
        running: false,
        error: null,
        graph: { directed: false, multigraph: false, nodes: [], links: [], hyperedges: [] },
      })
    })

    expect(openTabMock).toHaveBeenCalledWith({ path: GRAPHIFY_GRAPH_TAB_PATH, content: '', dirty: false })
  })

  it('does not auto-open the Graph tab when a build finishes with an error', () => {
    useGraphifyStore.setState({ available: true, running: true, graph: null })
    render(<GraphifyPanel />)

    act(() => {
      useGraphifyStore.setState({ running: false, error: 'graphify exited with code 1', graph: null })
    })

    expect(openTabMock).not.toHaveBeenCalled()
  })

  it('disables Build/Rebuild, Open Graph, and Open Report when there is no project open', () => {
    setProjectRoot(null)
    useGraphifyStore.setState({ available: true, graph: null })
    render(<GraphifyPanel />)

    expect(screen.getByRole('button', { name: /build graph/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /open graph/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /open report/i })).toBeDisabled()
  })
})
