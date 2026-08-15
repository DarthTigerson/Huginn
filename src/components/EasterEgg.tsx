import { useCallback, useEffect, useState } from 'react'
import { useKonamiCode } from '@/lib/useKonamiCode'
import binksSakeUrl from '@/assets/binksSake.mp3'

// Mirrors .easter-egg-ship's 8s CSS animation (index.css) — the fade needs
// to finish right as the ship sails off-screen, not before or after, so
// it's kept in lockstep with that value rather than derived from it.
const SAIL_DURATION_MS = 8000
const FADE_DURATION_MS = 1500
const FADE_STEP_MS = 50

export function EasterEgg() {
  const [runId, setRunId] = useState<number | null>(null)

  const activate = useCallback(() => {
    setRunId((id) => (id ?? 0) + 1)
  }, [])

  useKonamiCode(activate)

  useEffect(() => {
    if (runId === null) return
    const audio = new Audio(binksSakeUrl)
    audio.play().catch(() => {
      // Autoplay can be blocked before the user has interacted with the
      // window at all — the Konami code itself counts as interaction in
      // every real case, so this is just a defensive no-op.
    })

    let fadeInterval: ReturnType<typeof setInterval> | undefined
    const fadeStart = setTimeout(() => {
      const steps = FADE_DURATION_MS / FADE_STEP_MS
      let step = 0
      fadeInterval = setInterval(() => {
        step += 1
        audio.volume = Math.max(0, 1 - step / steps)
        if (step >= steps) clearInterval(fadeInterval)
      }, FADE_STEP_MS)
    }, SAIL_DURATION_MS - FADE_DURATION_MS)

    return () => {
      clearTimeout(fadeStart)
      clearInterval(fadeInterval)
      audio.pause()
    }
  }, [runId])

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
