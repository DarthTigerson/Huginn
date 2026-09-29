/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { FileTree } from '../FileTree'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'
import { useGitStore, emptyRepoGitState } from '@/stores/gitStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGeneralSettingsStore, type FileTreeGitStatus } from '@/stores/generalSettingsStore'
import type { FileNode } from '@/types/index'

const nodes: FileNode[] = [
  { name: 'src', path: '/proj/src', isDirectory: true, children: [] },
  { name: 'a.ts', path: '/proj/a.ts', isDirectory: false },
]

function noop() {}

beforeEach(() => {
  useFileStore.setState({ projectRoot: '/proj', expandedPaths: new Set(), revealedPath: null })
  useEditorStore.setState({ activeTabPath: null } as any)
  useGitReposStore.setState({ repos: ['/proj'], selectedRepo: '/proj' })
  useGitStore.setState({
    repos: {
      '/proj': {
        ...emptyRepoGitState,
        ignoredPaths: [],
        status: { staged: [], unstaged: [{ path: 'a.ts', status: 'M' }, { path: 'src/b.ts', status: 'M' }] },
      },
    },
  })
  ;(global as any).window.api = { readFile: vi.fn().mockResolvedValue('') }
})

afterEach(() => {
  cleanup()
})

function renderTree(mode: FileTreeGitStatus) {
  useGeneralSettingsStore.setState({ fileTreeGitStatus: mode })
  return render(
    <FileTree
      nodes={nodes}
      directoryPath="/proj"
      onContextMenu={noop}
      prompt={null}
      setPromptValue={noop}
      commitPrompt={noop}
      cancelPrompt={noop}
      dragOverPath={null}
      setDragOverPath={noop}
      onMoveNode={noop}
      onDropExternal={noop}
    />
  )
}

const name = (text: string) => screen.getByText(text, { selector: 'span' })
const badge = () => screen.queryByText('M', { selector: 'span' })
const folderDot = (container: HTMLElement) => container.querySelector('[data-git-folder-dot]')

describe('FileTree git status display setting', () => {
  it('Letter + Colour: badge, coloured file name, and coloured folder with a dot', () => {
    const { container } = renderTree('letterAndColour')
    expect(folderDot(container)).toHaveClass('text-amber-400')
    expect(badge()).toHaveClass('text-amber-400')
    expect(name('a.ts')).toHaveClass('text-amber-400')
    expect(name('src')).toHaveClass('text-amber-400')
  })

  it('Letter: badge only, names keep their normal colour', () => {
    const { container } = renderTree('letter')
    expect(badge()).toHaveClass('text-amber-400')
    expect(name('a.ts')).toHaveClass('text-fg')
    expect(name('src')).toHaveClass('text-fg')
  })

  it('Letter: a folder with changes inside shows a dot in the status colour', () => {
    const { container } = renderTree('letter')
    expect(folderDot(container)).toHaveClass('text-amber-400')
  })

  it('Off: no badge and no colours', () => {
    const { container } = renderTree('off')
    expect(folderDot(container)).toBeNull()
    expect(badge()).toBeNull()
    expect(name('a.ts')).toHaveClass('text-fg')
    expect(name('src')).toHaveClass('text-fg')
  })
})
