import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import type { FileNode } from '@/types/index'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'
import { isGitDiffTab, parseGitDiffPath } from '@/components/Git/paths'
import { FileIcon, FolderIcon } from './FileIcon'

export type TreePromptKind = 'file' | 'directory' | 'rename'

export interface TreePromptState {
  kind: TreePromptKind
  value: string
  directory: string
  node: FileNode | null
}

interface FileTreeProps {
  nodes: FileNode[]
  directoryPath: string
  depth?: number
  onContextMenu: (event: MouseEvent, node: FileNode) => void
  prompt: TreePromptState | null
  autoExpandPath: string | null
  collapseAllKey?: number
  setPromptValue: (value: string) => void
  commitPrompt: () => void
  cancelPrompt: () => void
}

function InlineNameInput({ prompt, depth, setPromptValue, commitPrompt, cancelPrompt }: {
  prompt: TreePromptState
  depth: number
  setPromptValue: (value: string) => void
  commitPrompt: () => void
  cancelPrompt: () => void
}) {
  return (
    <div
      className="flex items-center gap-1 py-0.5"
      style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '8px' }}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <span className="shrink-0 text-xs w-3 text-fg-subtle" />
      {prompt.kind === 'directory' || prompt.node?.isDirectory ? (
        <FolderIcon open={false} />
      ) : (
        <FileIcon name={prompt.value || 'file'} />
      )}
      <input
        value={prompt.value}
        onChange={(event) => setPromptValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitPrompt()
          if (event.key === 'Escape') cancelPrompt()
        }}
        onBlur={cancelPrompt}
        autoFocus
        placeholder={prompt.kind === 'directory' ? 'folder-name' : 'filename.ext'}
        className="min-w-0 flex-1 rounded border border-accent bg-panel px-1 py-0 text-sm text-fg outline-none placeholder:text-fg-subtle"
        style={{ userSelect: 'text' }}
      />
    </div>
  )
}

export function FileTree({
  nodes,
  directoryPath,
  depth = 0,
  onContextMenu,
  prompt,
  autoExpandPath,
  collapseAllKey,
  setPromptValue,
  commitPrompt,
  cancelPrompt,
}: FileTreeProps) {
  const { select, expandDir } = useFileStore()
  const { activeTabPath, openTab } = useEditorStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const activeFilePath = !activeTabPath
    ? null
    : isGitDiffTab(activeTabPath)
      ? parseGitDiffPath(activeTabPath).path
      : activeTabPath.includes('://')
        ? null
        : activeTabPath
  const createPromptHere = prompt && !prompt.node && prompt.directory === directoryPath

  useEffect(() => {
    if (collapseAllKey === undefined) return
    setExpanded({})
  }, [collapseAllKey])

  useEffect(() => {
    if (!autoExpandPath) return
    setExpanded((prev) => {
      const updates: Record<string, boolean> = {}
      for (const node of nodes) {
        if (!node.isDirectory) continue
        if (node.path === autoExpandPath || autoExpandPath.startsWith(node.path + '/')) {
          updates[node.path] = true
        }
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev
    })
  }, [autoExpandPath, nodes])

  async function handleClick(node: FileNode) {
    if (node.isDirectory) {
      const isOpen = expanded[node.path]
      if (!isOpen && node.children === undefined) {
        await expandDir(node.path)
      }
      setExpanded((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
    } else {
      select(node.path)
      const content = await window.api.readFile(node.path)
      openTab({ path: node.path, content, dirty: false })
    }
  }

  return (
    <ul>
      {createPromptHere && (
        <li>
          <InlineNameInput
            prompt={prompt}
            depth={depth}
            setPromptValue={setPromptValue}
            commitPrompt={commitPrompt}
            cancelPrompt={cancelPrompt}
          />
        </li>
      )}
      {nodes.map((node) => (
        <li key={node.path}>
          {prompt?.kind === 'rename' && prompt.node?.path === node.path ? (
            <InlineNameInput
              prompt={prompt}
              depth={depth}
              setPromptValue={setPromptValue}
              commitPrompt={commitPrompt}
              cancelPrompt={cancelPrompt}
            />
          ) : (
            <button
              className={`flex items-center gap-1 w-full text-left py-0.5 text-sm hover:bg-white/5 rounded truncate ${
                activeFilePath === node.path ? 'bg-accent/20 text-fg' : 'text-fg'
              }`}
              style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '8px' }}
              onClick={() => handleClick(node)}
              onContextMenu={(event) => onContextMenu(event, node)}
            >
              <span className="shrink-0 text-xs w-3 text-fg-subtle">
                {node.isDirectory
                  ? expanded[node.path]
                    ? '▾'
                    : '▸'
                  : ''}
              </span>
              {node.isDirectory ? (
                <FolderIcon open={!!expanded[node.path]} />
              ) : (
                <FileIcon name={node.name} />
              )}
              <span className="truncate text-fg">
                {node.name}
              </span>
            </button>
          )}
          {node.isDirectory && expanded[node.path] && node.children && (
            <FileTree
              nodes={node.children}
              directoryPath={node.path}
              depth={depth + 1}
              onContextMenu={onContextMenu}
              prompt={prompt}
              autoExpandPath={autoExpandPath}
              collapseAllKey={collapseAllKey}
              setPromptValue={setPromptValue}
              commitPrompt={commitPrompt}
              cancelPrompt={cancelPrompt}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
