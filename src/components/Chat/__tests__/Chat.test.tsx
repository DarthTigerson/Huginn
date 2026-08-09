import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { Chat } from '../Chat'
import { useFileStore } from '@/stores/fileStore'
import { useClaudeStore } from '@/stores/claudeStore'
import { SHIFT_ENTER_SEQUENCE } from '../shiftEnterSequence'

beforeEach(() => {
  ;(global as any).window.api = {
    ...(global as any).window.api,
    assistantSpawn: vi.fn(),
    assistantWrite: vi.fn(),
    assistantResize: vi.fn(),
    onAssistantData: vi.fn(() => () => {}),
  }
  useFileStore.setState({ projectRoot: '/project' })
  useClaudeStore.setState({ assistant: 'claude', restartToken: 0 })
})

afterEach(() => {
  cleanup()
  useFileStore.setState({ projectRoot: null })
})

describe('Chat (claude terminal)', () => {
  it('sends the ESC+CR sequence, not a plain CR, when Shift+Enter is pressed in the terminal', async () => {
    const { container } = render(<Chat />)

    const textarea = await waitFor(() => {
      const el = container.querySelector('.xterm-helper-textarea')
      if (!el) throw new Error('xterm helper textarea not mounted yet')
      return el as HTMLTextAreaElement
    })

    const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true })
    textarea.dispatchEvent(event)

    // Must be prevented: xterm's own _keyDown short-circuits before calling its
    // usual cancel()/preventDefault() once a custom handler returns false, so
    // without an explicit preventDefault() here the browser still inserts a
    // literal newline into xterm's textarea — which xterm's input handling then
    // forwards to the PTY as a stray extra keystroke, submitting anyway.
    expect(event.defaultPrevented).toBe(true)

    const writeMock = (window.api as any).assistantWrite as ReturnType<typeof vi.fn>
    expect(writeMock).toHaveBeenCalledWith('claude', SHIFT_ENTER_SEQUENCE)
    expect(writeMock).not.toHaveBeenCalledWith('claude', '\r')
    expect(writeMock).toHaveBeenCalledTimes(1)
  })

  it('lets plain Enter fall through to xterm instead of intercepting it', async () => {
    const { container } = render(<Chat />)

    const textarea = await waitFor(() => {
      const el = container.querySelector('.xterm-helper-textarea')
      if (!el) throw new Error('xterm helper textarea not mounted yet')
      return el as HTMLTextAreaElement
    })

    const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false, bubbles: true, cancelable: true })
    textarea.dispatchEvent(event)

    // Our handler must not have called preventDefault/stopped this event — that's
    // how it signals xterm to fall back to its own default Enter handling.
    expect(event.defaultPrevented).toBe(false)
    const writeMock = (window.api as any).assistantWrite as ReturnType<typeof vi.fn>
    expect(writeMock).not.toHaveBeenCalledWith('claude', SHIFT_ENTER_SEQUENCE)
  })
})
