import { useGeneralSettingsStore } from '@/stores/generalSettingsStore'
import { useConfigRepoStore } from '@/stores/configRepoStore'
import { PreviewFrame, MiniPanes } from './primitives'

// Live pictures for Settings › General (VIDE-145).

// A small focused window beside a big one; the new tab lands per
// "Open new tabs in".
export function NewTabPreview() {
  const biggest = useGeneralSettingsStore((s) => s.newTabPane) === 'biggest'
  const newTab = { label: 'notes.md', isNew: true }
  return (
    <PreviewFrame testId="new-tab-preview">
      <MiniPanes panes={[
        { id: 'focused', grow: 1, focused: true, tabs: [{ label: 'App.tsx' }, ...(biggest ? [] : [newTab])] },
        { id: 'big', grow: 2, tabs: [{ label: 'Editor.tsx' }, ...(biggest ? [newTab] : [])] },
      ]} />
    </PreviewFrame>
  )
}

// "owner/repo" from a clone URL (https or ssh), or null while it's not set.
export function repoNameFromUrl(url: string): string | null {
  const trimmed = url.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  const parts = trimmed.split(/[/:]/).filter(Boolean)
  return parts.length >= 2 ? parts.slice(-2).join('/') : null
}

export function SyncPreview({ items }: { items: { key: string; label: string }[] }) {
  const enabled = useConfigRepoStore((s) => s.enabled)
  const repoUrl = useConfigRepoStore((s) => s.repoUrl)
  const categories = useConfigRepoStore((s) => s.categories)
  const repo = repoNameFromUrl(repoUrl)
  return (
    <PreviewFrame testId="sync-preview" caption="Your private repo">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <span className={['truncate font-mono text-[10.5px]', repo ? 'text-fg' : 'text-fg-subtle'].join(' ')}>
          {repo ?? 'no repository yet'}
        </span>
        <span className="shrink-0 text-[10px] text-fg-subtle">{enabled ? 'syncing' : 'off'}</span>
      </div>
      <div className="flex flex-wrap gap-1 px-2.5 pb-2.5">
        {items.map(({ key, label }) => (
          <span
            key={key}
            data-on={categories[key] ? 'true' : undefined}
            className={[
              'rounded-full border px-1.5 text-[10px]',
              categories[key] ? 'border-accent/50 bg-accent/20 text-fg' : 'border-border text-fg-subtle',
            ].join(' ')}
          >
            {label}
          </span>
        ))}
      </div>
    </PreviewFrame>
  )
}
