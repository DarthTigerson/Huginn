import { useCallback, useState } from 'react'
import { useKonamiCode } from '@/lib/useKonamiCode'

export function EasterEgg() {
  const [runId, setRunId] = useState<number | null>(null)

  const activate = useCallback(() => {
    setRunId((id) => (id ?? 0) + 1)
  }, [])

  useKonamiCode(activate)

  if (runId === null) return null

  // key={runId} forces a fresh element (and so a fresh CSS animation) each
  // time the code is re-entered, even if the previous sail already finished.
  return (
    <div
      key={runId}
      className="easter-egg-ship"
      aria-hidden="true"
      onAnimationEnd={() => setRunId(null)}
    />
  )
}
