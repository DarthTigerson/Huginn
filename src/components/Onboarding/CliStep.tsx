import { useEffect, useState } from 'react'
import { openUrlInBrowserTab } from '@/components/Chat/terminalLinks'

type CliState = 'checking' | 'found' | 'missing'

const CLIS: Array<{ bin: string; label: string; installUrl: string }> = [
  { bin: 'claude', label: 'Claude Code', installUrl: 'https://docs.claude.com/en/docs/claude-code/setup' },
  { bin: 'codex', label: 'Codex', installUrl: 'https://github.com/openai/codex' },
]

export function CliStep() {
  const [status, setStatus] = useState<Record<string, CliState>>({ claude: 'checking', codex: 'checking' })

  const runCheck = () => {
    setStatus({ claude: 'checking', codex: 'checking' })
    for (const cli of CLIS) {
      window.api.onboardingDetectCli(cli.bin).then((found) => {
        setStatus((prev) => ({ ...prev, [cli.bin]: found ? 'found' : 'missing' }))
      })
    }
  }

  useEffect(runCheck, [])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">CLI check</h2>
        <p className="text-xs text-fg-muted mt-0.5">
          Huginn launches these CLIs as terminal processes — it doesn't bundle them, so they need
          to be installed and on your PATH separately.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {CLIS.map((cli) => {
          const state = status[cli.bin]
          return (
            <div key={cli.bin} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <span className="text-sm text-fg">{cli.label}</span>
              {state === 'checking' && <span className="text-xs text-fg-muted">Checking…</span>}
              {state === 'found' && <span className="text-xs text-green-500">✓ Found</span>}
              {state === 'missing' && (
                <button
                  type="button"
                  onClick={() => openUrlInBrowserTab(cli.installUrl)}
                  className="text-xs text-accent hover:underline cursor-pointer"
                >
                  Not found — install docs
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={runCheck}
        className="self-start h-7 px-2.5 rounded border border-border text-xs text-fg-muted hover:text-fg hover:border-fg-subtle transition-colors"
      >
        Re-check
      </button>
    </div>
  )
}
