import { useDockerSettingsStore } from '@/stores/dockerSettingsStore'
import { formatMemory } from '@/components/Docker/DockerPanel'
import { FilesIcon, GitIcon, DockerIcon } from '@/components/ActivityBar/ActivityBar'
import { PreviewFrame } from './primitives'

// Live pictures for Settings › Docker (VIDE-145).

// A slice of the real activity bar: same icons, item size, inactive opacity
// and badge styling as ActivityBar.tsx, so the badge looks exactly as it will.
export function DockerBadgePreview() {
  const enabled = useDockerSettingsStore((s) => s.enabled)
  const showBadge = useDockerSettingsStore((s) => s.showBadge)
  const count = useDockerSettingsStore((s) => s.badgeMode) === 'projects' ? 2 : 5
  const items = [
    { key: 'files', icon: <FilesIcon /> },
    { key: 'git', icon: <GitIcon /> },
    ...(enabled ? [{ key: 'docker', icon: <DockerIcon />, badge: showBadge ? count : undefined }] : []),
  ]
  return (
    <PreviewFrame testId="docker-badge-preview">
      <div className="flex">
        <div className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-sidebar py-1">
          {items.map((item) => (
            <div key={item.key} className="relative flex h-12 w-12 items-center justify-center">
              <span className="text-fg-muted opacity-50">{item.icon}</span>
              {item.badge !== undefined && (
                <span
                  data-testid="docker-badge-preview-count"
                  className="absolute bottom-1 right-1 h-4 min-w-4 rounded-full bg-accent px-1 text-center text-[0.5625rem] font-bold leading-4 text-on-accent shadow shadow-black/40"
                >
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex-1" />
      </div>
    </PreviewFrame>
  )
}

const SAMPLE = [
  { name: 'api', stats: { usedBytes: 512 * 1024 ** 2, limitBytes: 2 * 1024 ** 3, percent: 25 } },
  { name: 'postgres', stats: { usedBytes: 1.3 * 1024 ** 3, limitBytes: 4 * 1024 ** 3, percent: 32.5 } },
]

export function DockerRowsPreview() {
  const showMemory = useDockerSettingsStore((s) => s.showMemory)
  const format = useDockerSettingsStore((s) => s.memoryFormat)
  return (
    <PreviewFrame testId="docker-rows-preview" caption="Docker panel">
      <div className="py-1">
        {SAMPLE.map(({ name, stats }) => (
          <div key={name} className="flex items-center gap-2 px-2.5 py-1 text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="flex-1 text-fg">{name}</span>
            {showMemory && <span className="tabular-nums text-fg-muted">{formatMemory(stats, format)}</span>}
          </div>
        ))}
      </div>
    </PreviewFrame>
  )
}
