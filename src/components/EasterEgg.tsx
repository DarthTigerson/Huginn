import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useKonamiCode } from '@/lib/useKonamiCode'
import binksSakeUrl from '@/assets/binksSake.mp3'
import narutoAudioUrl from '@/assets/naruto.mp3'

const FADE_DURATION_MS = 1500
const FADE_STEP_MS = 50

// Plays `url` (if any) for `totalMs`, fading it out over the last
// FADE_DURATION_MS so it doesn't just cut off mid-note when the animation
// ends. Shared by every egg so each one only has to declare its own total
// runtime, not reimplement the fade.
function useEggAudio(url: string | null, totalMs: number): void {
  useEffect(() => {
    if (!url) return
    const audio = new Audio(url)
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
    }, Math.max(0, totalMs - FADE_DURATION_MS))

    return () => {
      clearTimeout(fadeStart)
      clearInterval(fadeInterval)
      audio.pause()
    }
  }, [url, totalMs])
}

// Mirrors .easter-egg-ship's 8s CSS animation (index.css) — the fade needs
// to finish right as the ship sails off-screen, not before or after, so
// it's kept in lockstep with that value rather than derived from it.
const SAIL_DURATION_MS = 8000

function GoingMerryEgg({ onDone }: { onDone: () => void }) {
  useEggAudio(binksSakeUrl, SAIL_DURATION_MS)
  return <div className="easter-egg-ship" aria-hidden="true" onAnimationEnd={onDone} />
}

// Static landing-point trees a single naruto hops between (see
// .easter-egg-tree in index.css). Evenly spaced slots with a little jitter
// within each slot so it doesn't read as a too-mechanical grid, leaving
// margin at both edges.
const TREE_COUNT = 6
const TREE_MIN_HEIGHT_PX = 120
const TREE_MAX_HEIGHT_PX = 180

interface Tree {
  key: number
  leftPercent: number
  heightPx: number
}

function generateTrees(count: number): Tree[] {
  return Array.from({ length: count }, (_, key) => {
    const slotWidth = 100 / count
    const slotCenter = slotWidth * (key + 0.5)
    const jitter = (Math.random() - 0.5) * slotWidth * 0.6
    return {
      key,
      leftPercent: Math.min(97, Math.max(1, slotCenter + jitter)),
      heightPx: TREE_MIN_HEIGHT_PX + Math.random() * (TREE_MAX_HEIGHT_PX - TREE_MIN_HEIGHT_PX),
    }
  })
}

// Where the branch platform sits in narutoTree.png, as a fraction of the
// tree's own rendered height measured from the ground — read off the
// artwork (the branch sits roughly 31% down from the top of the image, so
// 1 - 0.31 from the bottom). Since .easter-egg-tree's aspect-ratio matches
// the source image exactly, this fraction of a tree's rendered heightPx is
// exactly the branch's height on screen, no letterboxing to account for.
const BRANCH_HEIGHT_FRACTION = 0.69
const NARUTO_SOLO_WIDTH_PX = 70
// How much higher the apex of each hop rises above whichever of its two
// endpoints is taller — without this every hop would just be a straight
// glide between heights rather than a rise-then-fall arc.
const HOP_ARC_EXTRA_PX = 40
const PIXELS_PER_SECOND = 240
const MIN_TOTAL_DURATION_S = 4
const MAX_TOTAL_DURATION_S = 9

interface JumpPoint {
  x: number
  y: number
  timing?: string
}

interface NarutoJump {
  css: string
  animationName: string
  totalMs: number
}

// Builds a full run's jump path and its CSS @keyframes text. Tree positions
// are random per run, so this can't be static hand-authored CSS — instead
// it's generated fresh each run from the actual generated tree x/y
// coordinates, converted to plain pixels (reading window.innerWidth once)
// rather than mixing vw/% with px, which would make computing hop
// midpoints between them a lot messier for no real benefit.
function buildNarutoJump(trees: Tree[], viewportWidth: number): NarutoJump {
  const animationName = `ee-naruto-solo-${Math.random().toString(36).slice(2, 10)}`

  // Right to left, matching the direction naruto actually runs in.
  const ordered = [...trees].sort((a, b) => b.leftPercent - a.leftPercent)
  const landingPoints: JumpPoint[] = ordered.map((t) => ({
    x: (t.leftPercent / 100) * viewportWidth,
    y: t.heightPx * BRANCH_HEIGHT_FRACTION,
  }))
  const start: JumpPoint = { x: viewportWidth + 200, y: 0 }
  const end: JumpPoint = { x: -300, y: 0 }
  const groundPoints = [start, ...landingPoints, end]

  const keyframePoints: JumpPoint[] = [{ x: start.x, y: start.y }]
  for (let i = 1; i < groundPoints.length; i++) {
    const prev = groundPoints[i - 1]
    const next = groundPoints[i]
    keyframePoints.push({
      x: (prev.x + next.x) / 2,
      y: Math.max(prev.y, next.y) + HOP_ARC_EXTRA_PX,
      timing: 'ease-out',
    })
    keyframePoints.push({ x: next.x, y: next.y, timing: 'ease-in' })
  }

  // Weight each keyframe's position on the timeline by cumulative travel
  // distance rather than even spacing, so a long jump between far-apart
  // trees doesn't take the same time as a short one.
  let cumulative = 0
  const cumulativeDistances = [0]
  for (let i = 1; i < keyframePoints.length; i++) {
    const a = keyframePoints[i - 1]
    const b = keyframePoints[i]
    cumulative += Math.hypot(b.x - a.x, b.y - a.y)
    cumulativeDistances.push(cumulative)
  }
  const totalDistance = cumulative || 1
  const percents = cumulativeDistances.map((d) => (d / totalDistance) * 100)

  const totalDurationS = Math.min(
    MAX_TOTAL_DURATION_S,
    Math.max(MIN_TOTAL_DURATION_S, totalDistance / PIXELS_PER_SECOND)
  )

  const lines = keyframePoints.map((kf, i) => {
    const timingDecl = kf.timing ? ` animation-timing-function: ${kf.timing};` : ''
    return `  ${percents[i].toFixed(3)}% { transform: translate(${kf.x.toFixed(1)}px, ${(-kf.y).toFixed(1)}px);${timingDecl} }`
  })

  return {
    css: `@keyframes ${animationName} {\n${lines.join('\n')}\n}`,
    animationName,
    totalMs: totalDurationS * 1000,
  }
}

function NarutoRunEgg({ onDone }: { onDone: () => void }) {
  // Generated once per mount (a fresh key={runId} from the parent forces a
  // fresh mount, and so a fresh path, on each Konami re-entry) rather than
  // on every render.
  const trees = useMemo(() => generateTrees(TREE_COUNT), [])
  const jump = useMemo(
    () => buildNarutoJump(trees, typeof window !== 'undefined' ? window.innerWidth : 1280),
    [trees]
  )

  useEggAudio(narutoAudioUrl, jump.totalMs)

  // onDone may be a fresh closure each time the parent re-renders; a ref
  // keeps the effects below callable without needing onDone in their deps.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const doneRef = useRef(false)
  const finishOnce = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current()
  }, [])

  // onAnimationEnd is the primary signal — immune to background-tab timer
  // throttling (Chromium can delay/coalesce setTimeout in an unfocused
  // window to as rarely as once a minute), which previously left the whole
  // run, trees included, stuck on screen if the window lost focus mid-run.
  // The setTimeout below is only a safety net in case that event is ever
  // missed for some reason.
  useEffect(() => {
    const safetyNet = setTimeout(finishOnce, jump.totalMs + 3000)
    return () => clearTimeout(safetyNet)
  }, [jump.totalMs, finishOnce])

  return (
    <div aria-hidden="true">
      <style>{jump.css}</style>
      {trees.map((t) => (
        <div
          key={`tree-${t.key}`}
          className="easter-egg-tree"
          style={{ left: `${t.leftPercent}%`, height: `${t.heightPx}px` }}
        />
      ))}
      <div
        className="easter-egg-naruto-solo"
        onAnimationEnd={finishOnce}
        style={{
          width: `${NARUTO_SOLO_WIDTH_PX}px`,
          animationName: jump.animationName,
          animationDuration: `${jump.totalMs}ms`,
        }}
      />
    </div>
  )
}

const EGGS = [
  { id: 'ship', Component: GoingMerryEgg },
  { id: 'naruto', Component: NarutoRunEgg },
] as const

export function EasterEgg() {
  const [run, setRun] = useState<{ runId: number; eggIndex: number } | null>(null)

  const activate = useCallback(() => {
    setRun((prev) => ({
      runId: (prev?.runId ?? 0) + 1,
      eggIndex: Math.floor(Math.random() * EGGS.length),
    }))
  }, [])

  useKonamiCode(activate)

  if (!run) return null

  const { Component } = EGGS[run.eggIndex]
  // key={runId} forces a fresh element (and so a fresh CSS animation) each
  // time the code is re-entered, even if the previous run already finished.
  return <Component key={run.runId} onDone={() => setRun(null)} />
}
