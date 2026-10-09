/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DockerBadgePreview, DockerRowsPreview } from '../dockerPreviews'
import { InlineEditPreview, CommitMessagePreview } from '../claudePreviews'
import { useDockerSettingsStore } from '@/stores/dockerSettingsStore'
import { useInlineEditSettingsStore } from '@/stores/inlineEditSettingsStore'
import { useCommitMessageSettingsStore } from '@/stores/commitMessageSettingsStore'

afterEach(cleanup)

describe('Docker previews', () => {
  it('counts containers or projects on the badge, and drops it when the count is off', () => {
    useDockerSettingsStore.setState({ enabled: true, showBadge: true, badgeMode: 'containers' })
    const { rerender } = render(<DockerBadgePreview />)
    expect(screen.getByTestId('docker-badge-preview-count')).toHaveTextContent('5')
    useDockerSettingsStore.setState({ badgeMode: 'projects' })
    rerender(<DockerBadgePreview />)
    expect(screen.getByTestId('docker-badge-preview-count')).toHaveTextContent('2')
    useDockerSettingsStore.setState({ showBadge: false })
    rerender(<DockerBadgePreview />)
    expect(screen.queryByTestId('docker-badge-preview-count')).toBeNull()
  })

  it('formats container memory exactly like the Docker panel', () => {
    useDockerSettingsStore.setState({ showMemory: true, memoryFormat: 'usedOverLimit' })
    const { rerender } = render(<DockerRowsPreview />)
    expect(screen.getByText('512 MB / 2 GB')).toBeInTheDocument()
    useDockerSettingsStore.setState({ showMemory: false })
    rerender(<DockerRowsPreview />)
    expect(screen.queryByText('512 MB / 2 GB')).toBeNull()
  })
})

describe('Claude previews', () => {
  it('shows the ⌘K box only while inline edit is on', () => {
    useInlineEditSettingsStore.setState({ enabled: true })
    const { rerender } = render(<InlineEditPreview />)
    expect(screen.getByText('Retry three times on failure')).toBeInTheDocument()
    useInlineEditSettingsStore.setState({ enabled: false })
    rerender(<InlineEditPreview />)
    expect(screen.queryByText('Retry three times on failure')).toBeNull()
  })

  it('shows the write-a-message button only while commit messages are on', () => {
    useCommitMessageSettingsStore.setState({ enabled: true })
    const { rerender } = render(<CommitMessagePreview />)
    expect(screen.getByTestId('commit-message-preview-button')).toBeInTheDocument()
    useCommitMessageSettingsStore.setState({ enabled: false })
    rerender(<CommitMessagePreview />)
    expect(screen.queryByTestId('commit-message-preview-button')).toBeNull()
  })
})
