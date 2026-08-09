import { useEffect, useRef, useState } from 'react'
import { useMobileStore } from '@/stores/mobileStore'

function PinDisplay({ pin }: { pin: string }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {pin.split('').map((digit, i) => (
        <div
          key={i}
          className="w-9 h-11 flex items-center justify-center rounded-lg bg-bg border border-border text-xl font-mono font-semibold text-fg"
        >
          {digit}
        </div>
      ))}
    </div>
  )
}

function CountdownRing({ onExpire }: { onExpire: () => void }) {
  const DURATION = 15
  const SIZE = 36
  const STROKE = 3
  const R = (SIZE - STROKE) / 2
  const CIRC = 2 * Math.PI * R

  const [remaining, setRemaining] = useState(DURATION)
  const startRef = useRef(Date.now())

  useEffect(() => {
    startRef.current = Date.now()
    setRemaining(DURATION)
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000
      const left = Math.max(0, DURATION - elapsed)
      setRemaining(left)
      if (left === 0) {
        clearInterval(id)
        onExpire()
      }
    }, 100)
    return () => clearInterval(id)
  }, [onExpire])

  const progress = remaining / DURATION
  const dashoffset = CIRC * (1 - progress)

  return (
    <div className="flex items-center gap-1.5 text-xs text-fg-muted">
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="currentColor" strokeWidth={STROKE} opacity={0.15} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none" stroke="currentColor" strokeWidth={STROKE}
          strokeDasharray={CIRC}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      <span>{Math.ceil(remaining)}s</span>
    </div>
  )
}

function QRImage({ svg }: { svg: string }) {
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return (
    <div className="flex justify-center">
      <div className="p-2 bg-white rounded-xl">
        <img src={dataUrl} width={140} height={140} alt="QR code to connect phone" />
      </div>
    </div>
  )
}

export function MobileDisplayPanel() {
  const state = useMobileStore((s) => s.state)
  const [toggling, setToggling] = useState(false)
  const pinRotatedRef = useRef<() => void>(() => {})
  const stableOnExpire = useRef(() => pinRotatedRef.current())

  useEffect(() => {
    useMobileStore.getState().init()
  }, [])

  useEffect(() => {
    pinRotatedRef.current = () => window.api.mobileGetState().then((s) => useMobileStore.setState({ state: s }))
  }, [state.pin])

  async function toggle() {
    setToggling(true)
    if (state.running) {
      await window.api.mobileStop()
    } else {
      await window.api.mobileStart()
    }
    setToggling(false)
  }

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      {/* Header */}
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Mobile Display
        </span>
        {state.connectedCount > 0 && (
          <span className="text-[0.625rem] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
            {state.connectedCount} connected
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {/* Toggle row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-fg">Enable mobile server</span>
          <button
            onClick={toggle}
            disabled={toggling}
            aria-label={state.running ? 'Stop mobile server' : 'Start mobile server'}
            className={[
              'relative w-10 h-5 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50',
              state.running ? 'bg-accent' : 'bg-fg-muted/30',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                state.running ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')}
            />
          </button>
        </div>

        {!state.running && (
          <p className="text-xs text-fg-muted text-center leading-relaxed pt-2">
            Turn on to start the local server and connect your phone.
          </p>
        )}

        {state.running && state.allowingNewDevice && (
          <>
            {/* QR Code */}
            {state.qrSvg && <QRImage svg={state.qrSvg} />}

            {/* URL */}
            <p className="text-[0.6875rem] text-fg-muted text-center font-mono">
              http://{state.localIp}:{state.port}
            </p>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* PIN section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-fg-muted uppercase tracking-wider">PIN</span>
                <CountdownRing key={state.pin} onExpire={stableOnExpire.current} />
              </div>
              {state.pin && <PinDisplay pin={state.pin} />}
              <p className="text-[0.6875rem] text-fg-muted text-center leading-relaxed">
                Scan the QR code on your phone,<br />then enter this PIN to connect.
              </p>
            </div>
          </>
        )}

        {state.running && !state.allowingNewDevice && (
          <div className="flex flex-col gap-3 pt-1">
            {/* Connected indicator */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/10 border border-accent/20">
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <span className="text-xs font-medium text-fg">
                {state.connectedCount === 1 ? '1 device connected' : `${state.connectedCount} devices connected`}
              </span>
            </div>

            {/* Add another device */}
            <button
              onClick={() => window.api.mobileAddDevice()}
              className="w-full py-2 text-xs font-medium text-fg-muted border border-border rounded-lg hover:text-fg hover:border-fg-muted transition-colors"
            >
              Connect another device
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
