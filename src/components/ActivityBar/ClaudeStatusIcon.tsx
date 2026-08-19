import { useEffect, useState } from 'react'
import { useClaudeStore } from '@/stores/claudeStore'
import { ClaudeIcon } from './ActivityBar'
import clawdDancingGif from '@/assets/clawdDancing.gif'
import clawdWorkingGif from '@/assets/clawdWorking.gif'

const WORKING_GIFS = [clawdDancingGif, clawdWorkingGif]
const CYCLE_INTERVAL_MS = 60_000

function pickGif(): string {
  return WORKING_GIFS[Math.floor(Math.random() * WORKING_GIFS.length)]
}

// Swaps the static Claude logo for a randomly-picked looping gif whenever
// electron/claude.ts reports Claude as busy (see its ECHO_WINDOW_MS comment
// for how "busy" is inferred from PTY output timing), re-rolling the pick
// every minute so a long-running turn doesn't just freeze on one animation.
export function ClaudeStatusIcon() {
  const busy = useClaudeStore((s) => s.busyByAssistant.claude ?? false)
  const [gif, setGif] = useState<string | null>(null)

  useEffect(() => {
    if (!busy) {
      setGif(null)
      return
    }
    setGif(pickGif())
    const interval = setInterval(() => setGif(pickGif()), CYCLE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [busy])

  if (busy && gif) {
    return <img src={gif} alt="Claude is working" className="w-[1.375rem] h-[1.375rem] object-contain" />
  }
  return <ClaudeIcon />
}
