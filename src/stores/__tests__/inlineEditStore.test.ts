import { describe, it, expect, beforeEach } from 'vitest'
import { useInlineEditStore, type InlineEditTarget } from '../inlineEditStore'

const TARGET: InlineEditTarget = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 }
const OWNER_A = { name: 'editor-a' }
const OWNER_B = { name: 'editor-b' }

describe('inlineEditStore', () => {
  beforeEach(() => {
    useInlineEditStore.setState({
      status: 'idle', owner: null, requestId: null, target: null, accumulatedText: '', errorMessage: null,
    })
  })

  it('defaults to idle with no owner or target', () => {
    const s = useInlineEditStore.getState()
    expect(s.status).toBe('idle')
    expect(s.owner).toBeNull()
    expect(s.target).toBeNull()
  })

  it('openPrompt sets prompting, owner, and target, clearing any prior request state', () => {
    useInlineEditStore.setState({ requestId: 'stale', accumulatedText: 'stale text', errorMessage: 'stale error' })
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)

    const s = useInlineEditStore.getState()
    expect(s.status).toBe('prompting')
    expect(s.owner).toBe(OWNER_A)
    expect(s.target).toEqual(TARGET)
    expect(s.requestId).toBeNull()
    expect(s.accumulatedText).toBe('')
    expect(s.errorMessage).toBeNull()
  })

  it('closePrompt resets to idle and clears owner and target', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().closePrompt()

    const s = useInlineEditStore.getState()
    expect(s.status).toBe('idle')
    expect(s.owner).toBeNull()
    expect(s.target).toBeNull()
  })

  it('closePrompt clears requestId, accumulated text, and error message too', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().appendDelta('req-1', 'some text')
    useInlineEditStore.getState().closePrompt()

    const s = useInlineEditStore.getState()
    expect(s.requestId).toBeNull()
    expect(s.accumulatedText).toBe('')
    expect(s.errorMessage).toBeNull()
  })

  it('startGenerating sets generating and the request id, preserving owner and target', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')

    const s = useInlineEditStore.getState()
    expect(s.status).toBe('generating')
    expect(s.requestId).toBe('req-1')
    expect(s.owner).toBe(OWNER_A)
    expect(s.target).toEqual(TARGET)
  })

  it('appendDelta accumulates text for the matching request id', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().appendDelta('req-1', 'foo')
    useInlineEditStore.getState().appendDelta('req-1', 'bar')

    expect(useInlineEditStore.getState().accumulatedText).toBe('foobar')
  })

  it('appendDelta ignores a stale request id', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().appendDelta('req-0', 'stale')

    expect(useInlineEditStore.getState().accumulatedText).toBe('')
  })

  it('finishGenerating transitions to reviewing only for the matching request id', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().finishGenerating('req-0')
    expect(useInlineEditStore.getState().status).toBe('generating')

    useInlineEditStore.getState().finishGenerating('req-1')
    expect(useInlineEditStore.getState().status).toBe('reviewing')
  })

  it('fail transitions to error with the message only for the matching request id', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().fail('req-0', 'stale error')
    expect(useInlineEditStore.getState().status).toBe('generating')

    useInlineEditStore.getState().fail('req-1', 'Something went wrong')
    expect(useInlineEditStore.getState().status).toBe('error')
    expect(useInlineEditStore.getState().errorMessage).toBe('Something went wrong')
  })

  it('reset clears everything back to idle', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().startGenerating('req-1')
    useInlineEditStore.getState().appendDelta('req-1', 'text')
    useInlineEditStore.getState().reset()

    const s = useInlineEditStore.getState()
    expect(s.status).toBe('idle')
    expect(s.owner).toBeNull()
    expect(s.requestId).toBeNull()
    expect(s.target).toBeNull()
    expect(s.accumulatedText).toBe('')
    expect(s.errorMessage).toBeNull()
  })

  it('a second openPrompt from a different owner overwrites the owner (supersede)', () => {
    useInlineEditStore.getState().openPrompt(OWNER_A, TARGET)
    useInlineEditStore.getState().openPrompt(OWNER_B, TARGET)

    expect(useInlineEditStore.getState().owner).toBe(OWNER_B)
  })
})
