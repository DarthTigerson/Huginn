import { useEffect } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { useEditorStore } from '@/stores/editorStore'
import { buildGitDiffPath } from './paths'
import { FileRow } from './FileRow'

const pillButtonClass =
  'group w-full h-7 rounded-full flex items-center justify-center text-[10px] font-bold tracking-tight bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-accent/30 shadow-sm shadow-black/20 transition-all duration-150 hover:ring-accent/60 hover:from-accent/35 hover:to-accent/10 hover:scale-105 active:scale-95'

export function GitPanel() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const {
    status,
    commitMessage,
    commitError,
    refreshStatus,
    stage,
    unstage,
    stageAll,
    unstageAll,
    setCommitMessage,
    commit,
  } = useGitStore()
  const openTab = useEditorStore((s) => s.openTab)

  useEffect(() => {
    refreshStatus(projectRoot)
  }, [projectRoot, refreshStatus])

  const hasChanges = status.staged.length > 0 || status.unstaged.length > 0

  function openDiff(path: string, staged: boolean) {
    openTab({ path: buildGitDiffPath(path, staged), content: '', dirty: false })
  }

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Git Panel
        </span>
      </div>

      <div className="px-3 py-2 border-b border-border shrink-0 flex flex-col gap-1.5">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Message"
          rows={3}
          className="w-full resize-none rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        {commitError && <p className="text-xs text-red-400">{commitError}</p>}
        <button
          type="button"
          disabled={!commitMessage.trim() || status.staged.length === 0}
          onClick={() => projectRoot && commit(projectRoot)}
          className="w-full h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-accent/80 text-bg transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Commit
        </button>
      </div>

      {hasChanges ? (
        <div className="flex-1 overflow-y-auto py-1">
          {status.staged.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                  Staged Changes ({status.staged.length})
                </span>
                <button
                  type="button"
                  onClick={() => projectRoot && unstageAll(projectRoot)}
                  className="text-[11px] text-fg-muted transition-colors hover:text-fg"
                >
                  Unstage All
                </button>
              </div>
              {status.staged.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  staged
                  onToggle={() => projectRoot && unstage(projectRoot, file.path)}
                  onOpenDiff={() => openDiff(file.path, true)}
                />
              ))}
            </div>
          )}
          {status.unstaged.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
                  Changes ({status.unstaged.length})
                </span>
                <button
                  type="button"
                  onClick={() => projectRoot && stageAll(projectRoot)}
                  className="text-[11px] text-fg-muted transition-colors hover:text-fg"
                >
                  Stage All
                </button>
              </div>
              {status.unstaged.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  staged={false}
                  onToggle={() => projectRoot && stage(projectRoot, file.path)}
                  onOpenDiff={() => openDiff(file.path, false)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-fg-subtle">No changes</p>
        </div>
      )}

      <div className="border-t border-border shrink-0 px-3 py-2 flex flex-col gap-1.5">
        <button type="button" className={pillButtonClass} aria-label="Graph (not yet implemented)">
          Graph
        </button>
        <button type="button" className={pillButtonClass} aria-label="List Diff (not yet implemented)">
          List Diff
        </button>
        <button type="button" className={pillButtonClass} aria-label="GG (not yet implemented)">
          GG
        </button>
      </div>
    </div>
  )
}
