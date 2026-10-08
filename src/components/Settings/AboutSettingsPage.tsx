import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useUpdateStore } from '@/stores/updateStore'
import { COMPACT_PROSE_CLASSES } from '@/components/Viewer/proseClasses'
import { Section, Row } from './SettingsLayout'
import type { ChangelogRelease } from '../../../electron/changelog'

// "just now" / "5 min ago" / "2 hours ago" / "3 days ago"
export function formatCheckedAgo(at: number, now: number): string {
  const mins = Math.floor((now - at) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatReleaseDate(date: string | null): string {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Settings > About (VIDE-143): the running version, Check for updates, and
// every release so far — read from the CHANGELOG bundled with the app, so
// it works offline. The running version shows in the primary colour.
export function AboutSettingsPage() {
  const available = useUpdateStore((s) => s.available)
  const checking = useUpdateStore((s) => s.checking)
  const lastCheckedAt = useUpdateStore((s) => s.lastCheckedAt)
  const checkFailed = useUpdateStore((s) => s.checkFailed)
  const status = useUpdateStore((s) => s.status)
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates)
  const loadCheckStatus = useUpdateStore((s) => s.loadCheckStatus)
  const startUpdate = useUpdateStore((s) => s.startUpdate)
  const openUpdatePage = useUpdateStore((s) => s.openUpdatePage)

  // Injected by electron.vite.config.ts; absent under vitest.
  const current = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null

  const [releases, setReleases] = useState<ChangelogRelease[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    loadCheckStatus()
    window.api.getChangelogReleases().then(
      (list) => {
        setReleases(list)
        setSelected((prev) => prev ?? (list.find((r) => r.version === current)?.version ?? list[0]?.version ?? null))
      },
      () => setReleases([]),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep "checked 5 min ago" honest while the page stays open.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const statusLine = checking ? (
    <StatusDot tone="muted">Checking for updates…</StatusDot>
  ) : available ? (
    <StatusDot tone="accent">vIDE v{available.version} is available</StatusDot>
  ) : checkFailed ? (
    <StatusDot tone="bad">Couldn't reach GitHub. Check your connection and try again.</StatusDot>
  ) : (
    <StatusDot tone="good">Up to date{lastCheckedAt ? ` · checked ${formatCheckedAgo(lastCheckedAt, now)}` : ''}</StatusDot>
  )

  const release = releases?.find((r) => r.version === selected) ?? null

  return (
    // A flex column so Release history can take whatever height is left.
    <div className="flex h-full flex-col overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">About</h1>
      <p className="text-sm text-fg-muted mb-4">Your version of vIDE, updates, and every release so far.</p>

      <Section label="Version">
        <Row>
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-bg text-[0.9375rem] font-semibold text-fg">vI</div>
            <div className="min-w-0 flex-1">
              <div data-testid="about-version" className="text-[0.9375rem] font-semibold text-fg">
                vIDE {current && <span className="text-accent">{current}</span>}
              </div>
              <div className="mt-0.5">{statusLine}</div>
            </div>
            <button
              type="button"
              onClick={() => void checkForUpdates()}
              disabled={checking}
              className="flex h-8 shrink-0 items-center gap-2 rounded border border-border px-3 text-sm text-fg transition-colors hover:border-fg-subtle disabled:cursor-default disabled:text-fg-muted disabled:hover:border-border"
            >
              {checking ? <span className="update-check-spin h-3 w-3 rounded-full border-2 border-fg-subtle border-t-accent" /> : <RefreshIcon />}
              {checking ? 'Checking…' : 'Check for updates'}
            </button>
          </div>

          {available && (
            <div data-testid="about-update-banner" className="mt-3 flex items-center gap-3 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2.5">
              <div className="min-w-0 flex-1 text-sm text-fg">
                {status === 'ready' ? `v${available.version} is installed` : status === 'updating' ? `Updating to v${available.version}…` : `vIDE v${available.version} is ready to install`}
                <div className="mt-0.5 text-xs text-fg-muted">
                  {status === 'ready' ? 'Restart vIDE to start using it.' : 'It downloads and installs on the Update page, then asks you to restart.'}
                </div>
              </div>
              <button
                type="button"
                onClick={status === 'idle' || status === 'failed' ? startUpdate : openUpdatePage}
                className="h-8 shrink-0 rounded-full border border-accent bg-accent px-4 text-sm font-semibold text-on-accent"
              >
                {status === 'idle' || status === 'failed' ? `Update to v${available.version}` : 'Open Update page'}
              </button>
            </div>
          )}
        </Row>
      </Section>

      {/* Same look as <Section>/<Row>, but stretched to the bottom of the page. */}
      <section className="flex min-h-[20rem] flex-1 flex-col pt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-muted">Release history</h2>
        <div className="flex min-h-0 flex-1 flex-col pl-3">
          {releases === null ? (
            <p className="text-sm text-fg-subtle">Loading releases…</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-fg-subtle">No release notes found.</p>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border">
              <div role="listbox" aria-label="Releases" className="overflow-y-auto border-r border-border bg-sidebar">
                {releases.map((r) => {
                  const isSelected = r.version === selected
                  return (
                    <button
                      key={r.version}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelected(r.version)}
                      className={[
                        'flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-left text-sm transition-colors',
                        isSelected ? 'bg-accent/10 text-fg' : 'text-fg-muted hover:bg-white/5 hover:text-fg',
                      ].join(' ')}
                    >
                      <span className={r.version === current ? 'text-accent' : undefined}>v{r.version}</span>
                      <span className="text-xs text-fg-subtle">{formatReleaseDate(r.date)}</span>
                    </button>
                  )
                })}
              </div>
              <div data-testid="about-release-notes" className="overflow-y-auto px-4 py-3">
                {release && (
                  <>
                    <div className="flex items-baseline gap-2.5">
                      <span className={['text-[0.9375rem] font-semibold', release.version === current ? 'text-accent' : 'text-fg'].join(' ')}>v{release.version}</span>
                      <span className="text-xs text-fg-subtle">{formatReleaseDate(release.date)}</span>
                    </div>
                    <div className={[COMPACT_PROSE_CLASSES, '!px-0 !py-2'].join(' ')}>
                      <ReactMarkdown>{release.body}</ReactMarkdown>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StatusDot({ tone, children }: { tone: 'good' | 'accent' | 'bad' | 'muted'; children: React.ReactNode }) {
  const dot = { good: 'bg-green-500', accent: 'bg-accent', bad: 'bg-red-400', muted: 'bg-fg-subtle' }[tone]
  return (
    <span className={['flex items-center gap-1.5 text-xs', tone === 'bad' ? 'text-red-400' : 'text-fg-muted'].join(' ')}>
      <span className={['h-1.5 w-1.5 shrink-0 rounded-full', dot].join(' ')} />
      {children}
    </span>
  )
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4v5h.6m15.4 2A8 8 0 0 0 4.6 9m0 0H9m11 11v-5h-.6m0 0a8 8 0 0 1-15.4-2m15.4 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
