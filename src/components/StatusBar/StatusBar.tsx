import { useEffect, useState } from 'react'
import { useGitStore, useRepoGitState } from '@/stores/gitStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { GitIcon, AutocompleteIcon } from '@/components/ActivityBar/ActivityBar'
import { GitActionsMenu } from '@/components/Git/GitActionsMenu'
import { ConfirmForcePushModal } from '@/components/Git/ConfirmForcePushModal'
import { useForcePushConfirm } from '@/components/Git/useForcePushConfirm'
import { useGitResetConfirm } from '@/components/Git/useGitResetConfirm'
import { ConfirmUndoCommitModal } from '@/components/Git/ConfirmUndoCommitModal'
import { ConfirmHardResetModal } from '@/components/Git/ConfirmHardResetModal'
import { GitResetPalette } from '@/components/Git/GitResetPalette'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'
import { AUTOCOMPLETE_FORCE_DISABLED } from '@/lib/autocompleteEffectiveState'
import { useConfigRepoStore } from '@/stores/configRepoStore'
import { FooterMessage } from './FooterMessage'
import { NotificationPanel } from './NotificationPanel'
import { NotificationBell } from './NotificationBell'
import { NotificationPeek } from './NotificationPeek'
import { FontSizeControl } from './FontSizeControl'
import { Clock } from './Clock'
import { GitActivityBar } from './GitActivityBar'
import { FooterBlame } from './FooterBlame'

export function StatusBar() {
  const repos = useGitReposStore((s) => s.repos)
  const selectedRepo = useGitReposStore((s) => s.selectedRepo)
  const hasExplicitSelection = useGitReposStore((s) => s.hasExplicitSelection)
  const isMultiRepo = repos.length > 1
  const { branch, aheadBehind, commandStatus, silentFetchInFlight } = useRepoGitState(selectedRepo)
  // In a multi-repo project, stay silent until a repo has actually been
  // picked (dropdown, "Show All Repos" row, or opening a file that
  // resolves to one) — showing the arbitrary first repo's branch with
  // nothing indicating which repo it belongs to is more confusing than
  // showing nothing. Single-repo projects are unaffected (unchanged from
  // before this feature existed).
  const showBranch = !!branch && (!isMultiRepo || hasExplicitSelection)
  const selectedRepoName = selectedRepo?.split('/').pop()
  const gitBusy = commandStatus === 'running' || silentFetchInFlight
  const refreshBranch = useGitStore((s) => s.refresh)
  const [gitMenuOpen, setGitMenuOpen] = useState(false)
  const { forceAction, requestForce, closeForce } = useForcePushConfirm(selectedRepo)
  const { step: resetStep, requestResetToHead, requestUndoCommit, requestHardReset, pickRef, close: closeReset } = useGitResetConfirm()
  const syncEnabled = useConfigRepoStore((s) => s.enabled)
  const syncRepoUrl = useConfigRepoStore((s) => s.repoUrl)
  const syncStatus = useConfigRepoStore((s) => s.status)
  const syncNow = useConfigRepoStore((s) => s.push)
  const autocompleteEnabled = useAutocompleteSettingsStore((s) => s.enabled)
  const autocompletePaused = useAutocompleteSessionStore((s) => s.paused)
  const togglePaused = useAutocompleteSessionStore((s) => s.togglePaused)
  const autocompleteBusy = useAutocompleteStatusStore((s) => s.busy)
  const autocompleteActive = autocompleteEnabled && !autocompletePaused
  const autocompleteVisible = !AUTOCOMPLETE_FORCE_DISABLED && autocompleteEnabled
  const [autocompleteMenuOpen, setAutocompleteMenuOpen] = useState(false)

  useEffect(() => {
    if (!gitMenuOpen) return
    const close = () => setGitMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [gitMenuOpen])

  useEffect(() => {
    if (!autocompleteMenuOpen) return
    const close = () => setAutocompleteMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [autocompleteMenuOpen])

  useEffect(() => {
    refreshBranch(selectedRepo)
    const onFocus = () => refreshBranch(selectedRepo)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [selectedRepo, refreshBranch])

  return (
    <div className="relative h-6 shrink-0 flex items-center justify-between px-3 bg-tab-bar border-t border-border select-none">
      <GitActivityBar />
      <FooterMessage />
      {/* Branch, then current-line blame (Settings > Git > Blame: Footer), which truncates first. */}
      <div className="flex items-center gap-3 min-w-0">
        {showBranch && (
          <div className="relative min-w-0">
            <span
              className="flex items-center gap-1 min-w-0 text-fg-muted text-xs cursor-default select-none hover:text-fg transition-colors"
              onContextMenu={(e) => { e.preventDefault(); setGitMenuOpen((o) => !o) }}
            >
              <GitIcon
                className={[
                  'w-3 h-3 shrink-0 transition-colors',
                  gitBusy ? 'text-accent animate-pulse' : '',
                ].join(' ')}
              />
              {selectedRepoName && (
                <>
                  <span className="font-bold text-fg truncate shrink-0">{selectedRepoName}</span>
                  <span className="text-fg-subtle shrink-0">›</span>
                </>
              )}
              <span className="truncate">{branch}</span>
              {commandStatus === 'running' ? (
                <span className="ml-1.5 text-fg-subtle animate-pulse shrink-0">●</span>
              ) : (
                aheadBehind && (
                  <span className="flex items-center gap-1.5 tabular-nums ml-1.5 shrink-0">
                    <span>↓{aheadBehind.behind}</span>
                    <span>↑{aheadBehind.ahead}</span>
                  </span>
                )
              )}
            </span>
            {gitMenuOpen && (
              <GitActionsMenu
                onClose={() => setGitMenuOpen(false)}
                onRequestForce={requestForce}
                onRequestResetToHead={requestResetToHead}
                onRequestUndoCommit={requestUndoCommit}
                onRequestHardReset={requestHardReset}
              />
            )}
          </div>
        )}
        <FooterBlame showDivider={showBranch} />
      </div>
      {forceAction && selectedRepo && (
        <ConfirmForcePushModal action={forceAction} cwd={selectedRepo} onClose={closeForce} />
      )}
      {resetStep?.kind === 'confirmUndoCommit' && selectedRepo && (
        <ConfirmUndoCommitModal cwd={selectedRepo} onClose={closeReset} />
      )}
      {resetStep?.kind === 'pickRef' && selectedRepo && (
        <GitResetPalette projectRoot={selectedRepo} onClose={closeReset} onPick={pickRef} />
      )}
      {resetStep?.kind === 'confirmHard' && selectedRepo && (
        <ConfirmHardResetModal cwd={selectedRepo} targetRef={resetStep.ref} onClose={closeReset} />
      )}
      <div className="flex items-center gap-1 text-fg-muted text-xs">
        {autocompleteVisible && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setAutocompleteMenuOpen((o) => !o) }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setAutocompleteMenuOpen((o) => !o) }}
              className={[
                'h-5 px-1 flex items-center justify-center transition-colors',
                autocompleteActive && autocompleteBusy
                  ? 'text-accent'
                  : autocompleteActive
                    ? 'text-fg-muted hover:text-fg'
                    : 'text-fg-subtle hover:text-fg-muted',
              ].join(' ')}
              aria-label={autocompleteActive ? 'Autocomplete on' : 'Autocomplete off'}
              title={autocompleteActive ? (autocompleteBusy ? 'Autocomplete: working…' : 'Autocomplete: on') : 'Autocomplete: off'}
            >
              <AutocompleteIcon
                crossedOut={!autocompleteActive}
                busy={autocompleteActive && autocompleteBusy}
              />
            </button>
            {autocompleteMenuOpen && (
              <div className="absolute bottom-full right-0 mb-1 w-56 rounded border border-border bg-popover shadow-lg shadow-black/40 py-1 z-50">
                <button
                  type="button"
                  onClick={() => { togglePaused(); setAutocompleteMenuOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-fg hover:bg-white/5 transition-colors"
                >
                  {autocompletePaused ? 'Resume' : 'Pause for this session'}
                </button>
              </div>
            )}
          </div>
        )}
        {/* Panel and peek anchor to this wrapper so they open right above the bell. */}
        <div className="relative flex mx-1">
          <NotificationBell />
          <NotificationPeek />
          <NotificationPanel />
        </div>
        {(syncEnabled || syncRepoUrl) && (
          <button
            type="button"
            onClick={syncNow}
            disabled={syncStatus === 'pushing' || syncStatus === 'connecting'}
            title={
              syncStatus === 'pushing' ? 'Pushing…' :
              syncStatus === 'error' ? 'Sync error — click to retry' :
              syncStatus === 'connecting' ? 'Connecting…' :
              'vIDE Sync — click to push now'
            }
            className={[
              // Same rounded/bordered pill as the bell and font-size chip beside it.
              'flex items-center justify-center h-5 w-5 shrink-0 rounded-full border bg-bg transition-colors disabled:cursor-default',
              syncStatus === 'pushing' || syncStatus === 'connecting'
                ? 'border-border text-accent animate-pulse'
                : syncStatus === 'error'
                  ? 'border-red-400/60 text-red-400 hover:text-red-300 hover:border-red-300'
                  : 'border-border text-fg-muted hover:text-fg hover:border-fg-subtle',
            ].join(' ')}
          >
            <SyncIcon />
          </button>
        )}
        <div className="ml-1">
          <FontSizeControl />
        </div>
        {/* Clock owns the far-right corner at every width (VIDE-140). */}
        <div className="ml-3">
          <Clock />
        </div>
      </div>
    </div>
  )
}

function SyncIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
