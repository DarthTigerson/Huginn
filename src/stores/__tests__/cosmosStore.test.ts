import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store, apiMock } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  const apiMock = {
    cosmosSend: vi.fn(),
    cosmosApprove: vi.fn(),
    cosmosReject: vi.fn(),
    cosmosCancel: vi.fn(),
    onCosmosEvent: vi.fn((_cb: (event: any) => void) => () => {}),
  }
  ;(global as any).window = { api: apiMock }
  return { store, apiMock }
})

import { useCosmosStore } from '../cosmosStore'

describe('cosmosStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    vi.clearAllMocks()
    useCosmosStore.setState({ messages: [], previousMessages: [], agentMode: false, streaming: false })
  })

  it('sendMessage appends a user message and calls window.api.cosmosSend', () => {
    useCosmosStore.getState().sendMessage('/project', 'hello')

    const state = useCosmosStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0]).toMatchObject({ role: 'user', content: 'hello' })
    expect(state.streaming).toBe(true)
    expect(apiMock.cosmosSend).toHaveBeenCalledWith('/project', [{ role: 'user', content: 'hello' }], false, expect.any(Object))
  })

  it('toggleAgentMode flips and persists agentMode', () => {
    useCosmosStore.getState().toggleAgentMode()
    expect(useCosmosStore.getState().agentMode).toBe(true)
    expect(store['huginn:cosmos:agentMode']).toBe('true')
  })

  it('newSession moves current messages to previousMessages and clears the transcript', () => {
    useCosmosStore.setState({ messages: [{ role: 'user', content: 'hi', status: 'done' } as any] })
    useCosmosStore.getState().newSession()

    const state = useCosmosStore.getState()
    expect(state.messages).toEqual([])
    expect(state.previousMessages).toHaveLength(1)
  })

  it('previousSession restores the saved transcript', () => {
    useCosmosStore.setState({ previousMessages: [{ role: 'user', content: 'old', status: 'done' } as any] })
    useCosmosStore.getState().previousSession()

    expect(useCosmosStore.getState().messages).toEqual([{ role: 'user', content: 'old', status: 'done' }])
  })

  it('approveToolCall/rejectToolCall delegate to window.api', () => {
    useCosmosStore.getState().approveToolCall('call_1')
    useCosmosStore.getState().rejectToolCall('call_2')
    expect(apiMock.cosmosApprove).toHaveBeenCalledWith('call_1')
    expect(apiMock.cosmosReject).toHaveBeenCalledWith('call_2')
  })

  it('handles a text-delta event by appending to the in-progress assistant message', () => {
    let handler: (e: any) => void = () => {}
    apiMock.onCosmosEvent.mockImplementation((cb) => { handler = cb; return () => {} })
    useCosmosStore.getState().initEventListener()

    useCosmosStore.getState().sendMessage('/project', 'hi')
    handler({ type: 'text-delta', delta: 'Hel' })
    handler({ type: 'text-delta', delta: 'lo' })

    const messages = useCosmosStore.getState().messages
    expect(messages[messages.length - 1]).toMatchObject({ role: 'assistant', content: 'Hello' })
  })

  it('handles a done event by clearing streaming state', () => {
    let handler: (e: any) => void = () => {}
    apiMock.onCosmosEvent.mockImplementation((cb) => { handler = cb; return () => {} })
    useCosmosStore.getState().initEventListener()

    useCosmosStore.getState().sendMessage('/project', 'hi')
    handler({ type: 'done' })

    expect(useCosmosStore.getState().streaming).toBe(false)
  })

  it('handles need-approval by adding a pending tool-call block to the assistant message', () => {
    let handler: (e: any) => void = () => {}
    apiMock.onCosmosEvent.mockImplementation((cb) => { handler = cb; return () => {} })
    useCosmosStore.getState().initEventListener()

    useCosmosStore.getState().sendMessage('/project', 'hi')
    handler({ type: 'tool-call', id: 'call_1', name: 'write_file', args: { path: '/x' } })
    handler({ type: 'need-approval', id: 'call_1', name: 'write_file', args: { path: '/x' } })

    const messages = useCosmosStore.getState().messages
    const assistantMsg = messages[messages.length - 1]
    expect(assistantMsg.toolCalls?.[0]).toMatchObject({ id: 'call_1', name: 'write_file', status: 'pending-approval' })
  })

  it('handles tool-result by updating the matching tool-call block to done/error', () => {
    let handler: (e: any) => void = () => {}
    apiMock.onCosmosEvent.mockImplementation((cb) => { handler = cb; return () => {} })
    useCosmosStore.getState().initEventListener()

    useCosmosStore.getState().sendMessage('/project', 'hi')
    handler({ type: 'tool-call', id: 'call_1', name: 'write_file', args: { path: '/x' } })
    handler({ type: 'tool-result', id: 'call_1', result: 'Wrote 2 bytes', isError: false })

    const messages = useCosmosStore.getState().messages
    const assistantMsg = messages[messages.length - 1]
    expect(assistantMsg.toolCalls?.[0]).toMatchObject({ id: 'call_1', status: 'done', result: 'Wrote 2 bytes' })
  })
})
