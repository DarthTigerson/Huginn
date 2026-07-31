import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useCosmosStore, type CosmosToolCallBlock } from '@/stores/cosmosStore'
import { useCosmosAgentModeShortcut } from './useCosmosAgentModeShortcut'

function ToolCallBlock({ block }: { block: CosmosToolCallBlock }) {
  const [expanded, setExpanded] = useState(block.status === 'pending-approval')
  const approveToolCall = useCosmosStore((s) => s.approveToolCall)
  const rejectToolCall = useCosmosStore((s) => s.rejectToolCall)

  const statusLabel = {
    'pending-approval': 'Waiting for approval',
    running: 'Running…',
    done: 'Done',
    error: 'Failed',
  }[block.status]

  return (
    <div className="rounded border border-border/60 px-2 py-1.5 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-mono text-fg">{block.name}</span>
        <span className="text-fg-muted">{statusLabel}</span>
      </button>

      {block.status === 'pending-approval' && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => approveToolCall(block.id)}
            className="h-6 px-2 rounded bg-accent/20 text-fg hover:bg-accent/30"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => rejectToolCall(block.id)}
            className="h-6 px-2 rounded border border-border text-fg-muted hover:text-fg"
          >
            Reject
          </button>
        </div>
      )}

      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap text-fg-muted">
          {JSON.stringify(block.args, null, 2)}
          {block.result ? `\n\n${block.result}` : ''}
        </pre>
      )}
    </div>
  )
}

function RegenerateIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-fg-muted opacity-50 hover:opacity-100 hover:text-fg transition-opacity"
      title="Copy"
    >
      <CopyIcon copied={copied} />
    </button>
  )
}

export function CosmosChat({ cwd }: { cwd: string }) {
  useCosmosAgentModeShortcut()
  const messages = useCosmosStore((s) => s.messages)
  const agentMode = useCosmosStore((s) => s.agentMode)
  const streaming = useCosmosStore((s) => s.streaming)
  const sendMessage = useCosmosStore((s) => s.sendMessage)
  const regenerate = useCosmosStore((s) => s.regenerate)
  const toggleAgentMode = useCosmosStore((s) => s.toggleAgentMode)
  const cancel = useCosmosStore((s) => s.cancel)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || streaming) return
    sendMessage(cwd, input)
    setInput('')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[90%]'}>
            <div
              className={[
                'rounded-lg px-3 py-2 text-sm',
                m.role === 'user' ? 'bg-accent/15 text-fg' : 'bg-white/5 text-fg',
              ].join(' ')}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
            {m.role === 'user' ? (
              <div className="mt-1 flex justify-end gap-0.5">
                <CopyButton text={m.content} />
                <button
                  type="button"
                  disabled={streaming}
                  onClick={() => regenerate(cwd, i)}
                  className="flex items-center gap-1 rounded px-1 py-0.5 text-xs text-fg-muted opacity-50 hover:opacity-100 hover:text-fg disabled:pointer-events-none transition-opacity"
                  title="Regenerate response"
                >
                  <RegenerateIcon />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex justify-start">
                <CopyButton text={m.content} />
              </div>
            )}
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1.5">
                {m.toolCalls.map((tc) => (
                  <ToolCallBlock key={tc.id} block={tc} />
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-border/60 p-2 flex flex-col gap-1.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit(e)
            }
          }}
          placeholder="Message Cosmos…"
          rows={2}
          className="w-full resize-none rounded border border-border bg-panel px-2 py-1.5 text-sm text-fg outline-none focus:border-accent"
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => toggleAgentMode()}
            className={[
              'rounded px-1.5 py-0.5 text-xs transition-colors',
              agentMode ? 'text-accent hover:text-accent/80' : 'text-fg-muted hover:text-fg',
            ].join(' ')}
          >
            Agent Mode: {agentMode ? 'On' : 'Off'}
          </button>
          {streaming && (
            <button
              type="button"
              onClick={() => cancel()}
              className="h-5 rounded border border-border px-2 text-xs text-fg-muted hover:border-fg-subtle hover:text-fg"
            >
              Stop
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
