import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useEditorStore } from '@/stores/editorStore'
import { useFileStore } from '@/stores/fileStore'
import { GraphView } from '../GraphView'
import type { GraphifyGraph } from '@/types/graphify'

const openTabMock = vi.fn()

vi.mock('@/stores/editorStore', () => ({
  useEditorStore: vi.fn(),
}))
vi.mock('@/stores/fileStore', () => ({
  useFileStore: vi.fn(),
}))

const graph: GraphifyGraph = {
  directed: false,
  multigraph: false,
  hyperedges: [],
  nodes: [
    { id: 'src_main', label: 'main.py', file_type: 'code', source_file: 'src/main.py', source_location: 'L1', _origin: 'ast', community: 0 },
    { id: 'src_math_utils', label: 'math_utils.py', file_type: 'code', source_file: 'src/math_utils.py', source_location: 'L1', _origin: 'ast', community: 0 },
  ],
  links: [
    { source: 'src_main', target: 'src_math_utils', relation: 'imports_from', context: 'import', confidence: 'EXTRACTED', confidence_score: 1, source_file: 'src/main.py', source_location: 'L1', weight: 1, _origin: 'ast' },
  ],
}

describe('GraphView', () => {
  beforeEach(() => {
    openTabMock.mockClear()
    Object.defineProperty(window, 'api', {
      value: { readFile: vi.fn().mockResolvedValue('print("hi")') },
      writable: true,
      configurable: true,
    })
    vi.mocked(useEditorStore).mockImplementation((selector?: any) =>
      selector ? selector({ openTab: openTabMock } as any) : undefined
    )
    vi.mocked(useEditorStore).getState = vi.fn(() => ({ openTab: openTabMock }))
    vi.mocked(useFileStore).mockImplementation((selector: any) =>
      selector({ projectRoot: '/project' })
    )
  })

  it('renders one labeled node per graph node', () => {
    render(<GraphView graph={graph} />)
    expect(screen.getByText('main.py')).toBeInTheDocument()
    expect(screen.getByText('math_utils.py')).toBeInTheDocument()
  })

  it('clicking a node opens its source file in the editor', async () => {
    render(<GraphView graph={graph} />)
    fireEvent.click(screen.getByText('main.py'))

    await waitFor(() => expect(openTabMock).toHaveBeenCalled())
    expect(window.api.readFile).toHaveBeenCalledWith('/project/src/main.py')
    expect(openTabMock).toHaveBeenCalledWith({ path: '/project/src/main.py', content: 'print("hi")', dirty: false })
  })

  it('clicking a node whose file was moved/deleted does not throw an unhandled rejection', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(window.api.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ENOENT: no such file'))

    render(<GraphView graph={graph} />)
    fireEvent.click(screen.getByText('main.py'))

    await waitFor(() => expect(consoleWarnSpy).toHaveBeenCalled())
    expect(openTabMock).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('renders an empty state for a graph with no nodes', () => {
    render(<GraphView graph={{ ...graph, nodes: [], links: [] }} />)
    expect(screen.getByText(/no nodes/i)).toBeInTheDocument()
  })

  it('sets a finite, non-degenerate viewBox that fits every rendered node, with preserveAspectRatio', () => {
    const { container } = render(<GraphView graph={graph} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')

    const viewBox = svg?.getAttribute('viewBox')
    expect(viewBox).toBeTruthy()
    const [minX, minY, width, height] = viewBox!.split(' ').map(Number)
    expect([minX, minY, width, height].every(Number.isFinite)).toBe(true)
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)

    // Every rendered <g transform="translate(x, y)"> node position must fall
    // within the viewBox — this is the actual regression check for the bug
    // (nodes rendered outside a fixed-size, non-scaling SVG canvas).
    const groups = Array.from(container.querySelectorAll('g'))
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) {
      const match = g.getAttribute('transform')?.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/)
      expect(match).not.toBeNull()
      const [, xStr, yStr] = match!
      const x = Number(xStr)
      const y = Number(yStr)
      expect(x).toBeGreaterThanOrEqual(minX)
      expect(x).toBeLessThanOrEqual(minX + width)
      expect(y).toBeGreaterThanOrEqual(minY)
      expect(y).toBeLessThanOrEqual(minY + height)
    }
  })

  it('gives a single-node graph a non-degenerate (non-zero-size) viewBox', () => {
    const singleNodeGraph = {
      ...graph,
      nodes: [graph.nodes[0]],
      links: [],
    }
    const { container } = render(<GraphView graph={singleNodeGraph} />)
    const svg = container.querySelector('svg')
    const viewBox = svg?.getAttribute('viewBox')
    expect(viewBox).toBeTruthy()
    const [, , width, height] = viewBox!.split(' ').map(Number)
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)
  })
})
