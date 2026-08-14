import { describe, it, expect } from 'vitest'
import { detectGitRemoteProvider } from '../gitRemoteProvider'

describe('detectGitRemoteProvider', () => {
  it('detects github.com', () => {
    expect(detectGitRemoteProvider('https://github.com/acme/widgets')).toBe('github')
  })

  it('detects a self-hosted GitHub Enterprise instance', () => {
    expect(detectGitRemoteProvider('https://github.mycorp.internal/acme/widgets')).toBe('github')
  })

  it('detects gitlab.com', () => {
    expect(detectGitRemoteProvider('https://gitlab.com/acme/widgets')).toBe('gitlab')
  })

  it('detects a self-hosted GitLab instance', () => {
    expect(detectGitRemoteProvider('https://gitlab.mycorp.internal/acme/widgets')).toBe('gitlab')
  })

  it('detects bitbucket.org', () => {
    expect(detectGitRemoteProvider('https://bitbucket.org/acme/widgets')).toBe('bitbucket')
  })

  it('falls back to other for an unrecognized host', () => {
    expect(detectGitRemoteProvider('https://dev.azure.com/acme/widgets')).toBe('other')
  })

  it('falls back to other for an unparsable URL instead of throwing', () => {
    expect(detectGitRemoteProvider('not a url')).toBe('other')
  })

  it('falls back to other for an empty string', () => {
    expect(detectGitRemoteProvider('')).toBe('other')
  })
})
