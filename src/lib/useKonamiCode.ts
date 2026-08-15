import { useEffect, useRef } from 'react'

const SEQUENCE = [
  'arrowup', 'arrowup', 'arrowdown', 'arrowdown',
  'arrowleft', 'arrowright', 'arrowleft', 'arrowright',
  'b', 'a',
]

export function useKonamiCode(onActivate: () => void) {
  const bufferRef = useRef<string[]>([])
  // Ref so the listener never needs to be torn down/re-added just because
  // the caller passed a new closure — it's attached once for the app's life.
  const onActivateRef = useRef(onActivate)
  onActivateRef.current = onActivate

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      bufferRef.current = [...bufferRef.current, key].slice(-SEQUENCE.length)
      if (
        bufferRef.current.length === SEQUENCE.length &&
        bufferRef.current.every((k, i) => k === SEQUENCE[i])
      ) {
        bufferRef.current = []
        onActivateRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
