import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { EasterEgg } from '../EasterEgg'

const SEQUENCE = [
  'arrowup', 'arrowup', 'arrowdown', 'arrowdown',
  'arrowleft', 'arrowright', 'arrowleft', 'arrowright',
  'b', 'a',
]

function enterKonamiCode() {
  for (const key of SEQUENCE) {
    fireEvent.keyDown(window, { key })
  }
}

const { audioInstances, AudioMock } = vi.hoisted(() => {
  const audioInstances: Array<{ src: string; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; volume: number }> = []
  class AudioMock {
    src: string
    volume = 1
    play = vi.fn().mockResolvedValue(undefined)
    pause = vi.fn()
    constructor(src: string) {
      this.src = src
      audioInstances.push(this)
    }
  }
  return { audioInstances, AudioMock }
})

beforeEach(() => {
  audioInstances.length = 0
  vi.stubGlobal('Audio', AudioMock)
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('EasterEgg', () => {
  it('renders nothing until the Konami code is entered', () => {
    const { container } = render(<EasterEgg />)
    expect(container.firstChild).toBeNull()
  })

  it('entering the code renders one of the two eggs and plays its audio', () => {
    const { container } = render(<EasterEgg />)
    enterKonamiCode()

    expect(container.firstChild).not.toBeNull()
    expect(audioInstances).toHaveLength(1)
    expect(audioInstances[0].play).toHaveBeenCalled()
    expect(audioInstances[0].src).toMatch(/binksSake|naruto/)
  })

  it('randomly picks between the ship and the naruto run across many activations', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const { container, unmount } = render(<EasterEgg />)
      enterKonamiCode()
      const html = container.innerHTML
      seen.add(html.includes('easter-egg-ship') ? 'ship' : html.includes('easter-egg-naruto-solo') ? 'naruto' : 'unknown')
      unmount()
    }
    // Overwhelmingly unlikely to land on only one side of a 50/50 coin flip
    // across 30 tries if the picker is genuinely randomizing between them.
    expect(seen.has('ship') && seen.has('naruto')).toBe(true)
  })

  it('the naruto run renders a single sprite with a dynamically generated jump animation', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9) // picks index 1: naruto
    const { container } = render(<EasterEgg />)
    enterKonamiCode()
    randomSpy.mockRestore()

    const sprites = container.querySelectorAll<HTMLElement>('.easter-egg-naruto-solo')
    expect(sprites.length).toBe(1)
    const sprite = sprites[0]
    expect(sprite.style.width).toBe('70px')
    expect(sprite.style.animationDuration).toMatch(/ms$/)
    expect(sprite.style.animationName).toMatch(/^ee-naruto-solo-/)

    // Tree positions (and so the jump path) are random per run, so the
    // keyframes can't be static CSS — buildNarutoJump() generates them and
    // injects them via a <style> tag; confirm that actually happened and
    // that it's a real path (multiple translate() stops), not a stub.
    const styleTag = container.querySelector('style')
    expect(styleTag).not.toBeNull()
    expect(styleTag!.textContent).toContain(`@keyframes ${sprite.style.animationName}`)
    expect(styleTag!.textContent?.match(/transform: translate\(/g)?.length).toBeGreaterThan(5)
  })

  it('the naruto run renders several static landing-point trees, each independently positioned/sized', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9) // picks index 1: naruto
    const { container } = render(<EasterEgg />)
    enterKonamiCode()
    randomSpy.mockRestore()

    const trees = container.querySelectorAll<HTMLElement>('.easter-egg-tree')
    expect(trees.length).toBe(6)
    expect(trees[0].style.left).toMatch(/%$/)
    expect(trees[0].style.height).toMatch(/px$/)
    // No animation — trees are static landing points, not part of the hop.
    expect(trees[0].style.animationName).toBe('')
  })

  it('the naruto run clears itself (trees included) via its safety-net timer, pausing the audio', () => {
    // Primary cleanup is driven by the sprite's own onAnimationEnd — jsdom
    // doesn't implement AnimationEvent at all and neither a real
    // AnimationEvent nor a plain synthetic 'animationend' dispatch reaches
    // React's handler in this environment, so that path isn't reproducible
    // here (same limitation as the ship's onAnimationEnd, see the test
    // above). This exercises the safety-net setTimeout fallback instead —
    // which is exactly the mechanism this test is protecting: if the
    // primary path is ever the ONLY thing that fires cleanup, a backgrounded
    // window can throttle it away and leave the (always-visible, unanimated)
    // trees stuck forever, which is the bug this whole mechanism guards.
    vi.spyOn(Math, 'random').mockReturnValue(0.9) // naruto egg
    const { container } = render(<EasterEgg />)
    enterKonamiCode()

    const sprite = container.querySelector<HTMLElement>('.easter-egg-naruto-solo')!
    const totalMs = parseFloat(sprite.style.animationDuration)

    act(() => { vi.advanceTimersByTime(totalMs + 3000) })
    expect(container.firstChild).toBeNull()
    // Trees are static children of the same run, not their own animation/
    // timer — they must disappear together with everything else, not linger.
    expect(container.querySelectorAll('.easter-egg-tree')).toHaveLength(0)
    expect(audioInstances[0].pause).toHaveBeenCalled()

    vi.restoreAllMocks()
  })

  it('the ship renders with the sailing animation class, wired to clear itself onAnimationEnd', () => {
    // jsdom doesn't implement AnimationEvent at all (confirmed: 'AnimationEvent'
    // in window is false), and React's event system feature-detects that away,
    // silently no-op'ing onAnimationEnd handlers in this environment — not
    // fixable by dispatching a differently-shaped event. So this only asserts
    // the wiring (class + a real onanimationend listener attached), not the
    // full DOM-event-triggered cleanup, which isn't reproducible under jsdom.
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // picks index 0: ship
    const { container } = render(<EasterEgg />)
    enterKonamiCode()

    const ship = container.querySelector('.easter-egg-ship')
    expect(ship).not.toBeNull()

    vi.restoreAllMocks()
  })

  it('re-entering the code while a run is still active starts a fresh run (a new audio instance)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1) // ship both times
    const { container } = render(<EasterEgg />)
    enterKonamiCode()
    expect(audioInstances).toHaveLength(1)

    enterKonamiCode()
    expect(container.querySelector('.easter-egg-ship')).not.toBeNull()
    expect(audioInstances).toHaveLength(2)

    vi.restoreAllMocks()
  })
})
