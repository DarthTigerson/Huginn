import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CosmosChat } from '../CosmosChat'
import { useCosmosStore } from '@/stores/cosmosStore'

beforeEach(() => {
  ;(global as any).window.api = {
    ...(global as any).window.api,
    onCosmosEvent: vi.fn(() => () => {}),
    cosmosSend: vi.fn(),
    cosmosApprove: vi.fn(),
    cosmosReject: vi.fn(),
    cosmosCancel: vi.fn(),
  }
  useCosmosStore.setState({ messages: [], previousMessages: [], streaming: false, agentMode: false })
})

afterEach(() => cleanup())

describe('CosmosChat', () => {
  it('renders user and assistant message bubbles', () => {
    useCosmosStore.setState({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    })
    render(<CosmosChat cwd="/project" />)

    expect(screen.getByText('hello')).toBeTruthy()
    expect(screen.getByText('hi there')).toBeTruthy()
  })

  it('renders a pending-approval tool-call block with Approve/Reject buttons', () => {
    useCosmosStore.setState({
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'write_file', args: { path: '/x' }, status: 'pending-approval' }],
        },
      ],
    })
    render(<CosmosChat cwd="/project" />)

    expect(screen.getByText('write_file')).toBeTruthy()
    expect(screen.getByText('Approve')).toBeTruthy()
    expect(screen.getByText('Reject')).toBeTruthy()
  })

  it('calls approveToolCall when Approve is clicked', () => {
    useCosmosStore.setState({
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'write_file', args: { path: '/x' }, status: 'pending-approval' }],
        },
      ],
    })
    render(<CosmosChat cwd="/project" />)

    fireEvent.click(screen.getByText('Approve'))
    expect((global as any).window.api.cosmosApprove).toHaveBeenCalledWith('call_1')
  })

  it('sends a message on submit and clears the input', () => {
    render(<CosmosChat cwd="/project" />)

    const input = screen.getByPlaceholderText('Message Cosmos…') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'do the thing' } })
    fireEvent.submit(input.closest('form')!)

    expect((global as any).window.api.cosmosSend).toHaveBeenCalled()
    expect(input.value).toBe('')
  })

  it('shows an Agent Mode: On indicator when agentMode is true', () => {
    useCosmosStore.setState({ agentMode: true })
    render(<CosmosChat cwd="/project" />)

    expect(screen.getByText('Agent Mode: On')).toBeTruthy()
  })

  it('shows an Agent Mode: Off indicator when agentMode is false', () => {
    useCosmosStore.setState({ agentMode: false })
    render(<CosmosChat cwd="/project" />)

    expect(screen.getByText('Agent Mode: Off')).toBeTruthy()
  })

  it('toggles agentMode when the indicator is clicked', () => {
    useCosmosStore.setState({ agentMode: false })
    render(<CosmosChat cwd="/project" />)

    fireEvent.click(screen.getByText('Agent Mode: Off'))

    expect(useCosmosStore.getState().agentMode).toBe(true)
  })

  it('does not show a Stop button when not streaming', () => {
    useCosmosStore.setState({ streaming: false })
    render(<CosmosChat cwd="/project" />)

    expect(screen.queryByText('Stop')).toBeNull()
  })

  it('shows a Stop button while streaming that calls cancel()', () => {
    useCosmosStore.setState({ streaming: true })
    render(<CosmosChat cwd="/project" />)

    fireEvent.click(screen.getByText('Stop'))

    expect((global as any).window.api.cosmosCancel).toHaveBeenCalled()
    expect(useCosmosStore.getState().streaming).toBe(false)
  })

  it('defaults a pending-approval tool call to expanded, showing its args without an extra click', () => {
    useCosmosStore.setState({
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'write_file', args: { path: '/x', content: 'hello world' }, status: 'pending-approval' }],
        },
      ],
    })
    render(<CosmosChat cwd="/project" />)

    expect(screen.getByText(/hello world/)).toBeTruthy()
  })

  it('does not expand a non-pending tool call by default', () => {
    useCosmosStore.setState({
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'write_file', args: { path: '/x', content: 'hello world' }, status: 'done', result: 'ok' }],
        },
      ],
    })
    render(<CosmosChat cwd="/project" />)

    expect(screen.queryByText(/hello world/)).toBeNull()
  })
})
