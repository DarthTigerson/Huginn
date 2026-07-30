import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useCosmosStore, type CosmosToolCallBlock } from '@/stores/cosmosStore'

function ToolCallBlock({ block }: { block: CosmosToolCallBlock }) {
  const [expanded, setExpanded] = useState(false)
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

export function CosmosChat({ cwd }: { cwd: string }) {
  const messages = useCosmosStore((s) => s.messages)
  const agentMode = useCosmosStore((s) => s.agentMode)
  const streaming = useCosmosStore((s) => s.streaming)
  const sendMessage = useCosmosStore((s) => s.sendMessage)
  const toggleAgentMode = useCosmosStore((s) => s.toggleAgentMode)
  const initEventListener = useCosmosStore((s) => s.initEventListener)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => initEventListener(), [initEventListener])

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
      <div className="h-7 px-2 flex items-center justify-end shrink-0 border-b border-border/60">
        {agentMode && <span className="text-xs text-accent">Agent Mode</span>}
      </div>

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

      <form onSubmit={onSubmit} className="border-t border-border/60 p-2">
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
      </form>
    </div>
  )
}
