import { describe, it, expect, beforeEach, vi } from 'vitest'
import { subscribeToInlineEditEvents, startInlineEdit, cancelInlineEdit, _resetInlineEditClientForTesting } from '../inlineEditClient'
import { useInlineEditStore } from '@/stores/inlineEditStore'

describe('inlineEditClient', () => {
  beforeEach(() => {
    _resetInlineEditClientForTesting()
    useInlineEditStore.setState({
      status: 'idle', owner: null, requestId: null, target: null, accumulatedText: '', errorMessage: null,
    })
  })

  it('subscribeToInlineEditEvents only registers the IPC listener once', () => {
    const onInlineEditEvent = vi.fn()
    ;(global as any).window = { api: { onInlineEditEvent, inlineEditStart: vi.fn(), inlineEditCancel: vi.fn() } }

    subscribeToInlineEditEvents()
    subscribeToInlineEditEvents()

    expect(onInlineEditEvent).toHaveBeenCalledTimes(1)
  })

  it('routes a delta event to the store for the current request', () => {
    let handler: (event: any) => void = () => {}
    ;(global as any).window = {
      api: {
        onInlineEditEvent: (cb: (event: any) => void) => { handler = cb },
        inlineEditStart: vi.fn(),
        inlineEditCancel: vi.fn(),
      },
    }
    subscribeToInlineEditEvents()

    useInlineEditStore.getState().openPrompt({}, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })
    useInlineEditStore.getState().startGenerating('req-1')

    handler({ type: 'delta', requestId: 'req-1', text: 'hello' })

    expect(useInlineEditStore.getState().accumulatedText).toBe('hello')
  })

  it('routes a done event to the store', () => {
    let handler: (event: any) => void = () => {}
    ;(global as any).window = {
      api: {
        onInlineEditEvent: (cb: (event: any) => void) => { handler = cb },
        inlineEditStart: vi.fn(),
        inlineEditCancel: vi.fn(),
      },
    }
    subscribeToInlineEditEvents()

    useInlineEditStore.getState().openPrompt({}, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })
    useInlineEditStore.getState().startGenerating('req-1')
    handler({ type: 'done', requestId: 'req-1' })

    expect(useInlineEditStore.getState().status).toBe('reviewing')
  })

  it('routes an error event to the store', () => {
    let handler: (event: any) => void = () => {}
    ;(global as any).window = {
      api: {
        onInlineEditEvent: (cb: (event: any) => void) => { handler = cb },
        inlineEditStart: vi.fn(),
        inlineEditCancel: vi.fn(),
      },
    }
    subscribeToInlineEditEvents()

    useInlineEditStore.getState().openPrompt({}, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })
    useInlineEditStore.getState().startGenerating('req-1')
    handler({ type: 'error', requestId: 'req-1', message: 'Something went wrong' })

    expect(useInlineEditStore.getState().status).toBe('error')
    expect(useInlineEditStore.getState().errorMessage).toBe('Something went wrong')
  })

  it('startInlineEdit generates a fresh request id each call and starts generating', () => {
    const inlineEditStart = vi.fn()
    ;(global as any).window = { api: { onInlineEditEvent: vi.fn(), inlineEditStart, inlineEditCancel: vi.fn() } }

    startInlineEdit({ prefix: 'a', suffix: 'b', selection: 'c', instruction: 'd', language: 'typescript', model: 'claude-sonnet-5' })
    const firstId = useInlineEditStore.getState().requestId

    startInlineEdit({ prefix: 'a', suffix: 'b', selection: 'c', instruction: 'd', language: 'typescript', model: 'claude-sonnet-5' })
    const secondId = useInlineEditStore.getState().requestId

    expect(firstId).not.toBeNull()
    expect(secondId).not.toBeNull()
    expect(firstId).not.toBe(secondId)
    expect(useInlineEditStore.getState().status).toBe('generating')
    expect(inlineEditStart).toHaveBeenCalledTimes(2)
    expect(inlineEditStart.mock.calls[1][0]).toMatchObject({
      requestId: secondId, prefix: 'a', suffix: 'b', selection: 'c', instruction: 'd', language: 'typescript', model: 'claude-sonnet-5',
    })
  })

  it('cancelInlineEdit calls the IPC bridge and resets the store', () => {
    const inlineEditCancel = vi.fn()
    ;(global as any).window = { api: { onInlineEditEvent: vi.fn(), inlineEditStart: vi.fn(), inlineEditCancel } }

    useInlineEditStore.getState().openPrompt({}, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 })
    useInlineEditStore.getState().startGenerating('req-1')

    cancelInlineEdit()

    expect(inlineEditCancel).toHaveBeenCalledTimes(1)
    expect(useInlineEditStore.getState().status).toBe('idle')
  })
})
