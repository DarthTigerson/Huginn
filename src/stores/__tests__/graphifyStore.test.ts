import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGraphifyStore } from '../graphifyStore'
import type { GraphifyGraph } from '@/types/graphify'

const sampleGraph: GraphifyGraph = {
  directed: false,
  multigraph: false,
  hyperedges: [],
  nodes: [
    { id: 'src_main', label: 'main.py', file_type: 'code', source_file: 'src/main.py', source_location: 'L1', _origin: 'ast', community: 0, community_name: 'main.py', norm_label: 'main.py' },
    { id: 'src_math_utils', label: 'math_utils.py', file_type: 'code', source_file: 'src/math_utils.py', source_location: 'L1', _origin: 'ast', community: 0, community_name: 'main.py', norm_label: 'math_utils.py' },
  ],
  links: [
    { source: 'src_main', target: 'src_math_utils', relation: 'imports_from', context: 'import', confidence: 'EXTRACTED', confidence_score: 1, source_file: 'src/main.py', source_location: 'L1', weight: 1, _origin: 'ast' },
  ],
}

let dataHandler: ((id: string, data: string) => void) | null = null
let exitHandler: ((id: string, code: number) => void) | null = null

vi.stubGlobal('window', {
  api: {
    graphifyIsAvailable: vi.fn().mockResolvedValue(true),
    graphifyRun: vi.fn().mockResolvedValue(undefined),
    graphifyReadGraph: vi.fn().mockResolvedValue(sampleGraph),
    onGraphifyData: vi.fn((cb) => { dataHandler = cb; return () => { dataHandler = null } }),
    onGraphifyExit: vi.fn((cb) => { exitHandler = cb; return () => { exitHandler = null } }),
  },
})
vi.stubGlobal('crypto', { randomUUID: () => 'fixed-id' })

describe('graphifyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataHandler = null
    exitHandler = null
    useGraphifyStore.setState({
      available: null, checking: false, running: false, progress: '', error: null,
      graph: null, loadingGraph: false,
    })
  })

  it('checkAvailable sets available from window.api', async () => {
    await useGraphifyStore.getState().checkAvailable()
    expect(useGraphifyStore.getState().available).toBe(true)
  })

  it('run accumulates streamed progress and loads the graph on a clean exit', async () => {
    const runPromise = useGraphifyStore.getState().run('/project')
    expect(useGraphifyStore.getState().running).toBe(true)

    dataHandler?.('fixed-id', 'building graph...')
    expect(useGraphifyStore.getState().progress).toBe('building graph...')

    exitHandler?.('fixed-id', 0)
    await runPromise
    await Promise.resolve()

    expect(useGraphifyStore.getState().running).toBe(false)
    expect(window.api.graphifyReadGraph).toHaveBeenCalledWith('/project')
    expect(useGraphifyStore.getState().graph).toEqual(sampleGraph)
  })

  it('run sets an error and does not load the graph on a non-zero exit', async () => {
    const runPromise = useGraphifyStore.getState().run('/project')
    exitHandler?.('fixed-id', 1)
    await runPromise

    expect(useGraphifyStore.getState().running).toBe(false)
    expect(useGraphifyStore.getState().error).toContain('1')
    expect(window.api.graphifyReadGraph).not.toHaveBeenCalled()
  })

  it('a second run while one is in flight is a no-op', async () => {
    void useGraphifyStore.getState().run('/project')
    void useGraphifyStore.getState().run('/project')

    expect(window.api.graphifyRun).toHaveBeenCalledTimes(1)
  })

  it('loadGraph clears graph to null on failure', async () => {
    ;(window.api.graphifyReadGraph as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('missing'))
    await useGraphifyStore.getState().loadGraph('/project')

    expect(useGraphifyStore.getState().graph).toBeNull()
    expect(useGraphifyStore.getState().loadingGraph).toBe(false)
  })
})
