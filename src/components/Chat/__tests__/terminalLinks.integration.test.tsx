import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { Terminal as XTerm } from '@xterm/xterm'
import { Chat } from '../Chat'
import { useFileStore } from '@/stores/fileStore'
import { useClaudeStore } from '@/stores/claudeStore'

// Diagnostic/regression test: exercises the REAL link provider Chat.tsx
// registers on a REAL xterm buffer, rather than just the pure regex/parse
// helpers in terminalLinks.test.ts — catches wiring bugs (wrong regex passed
// to the wrong provider, provider never registered, etc.) that unit-testing
// FILE_PATH_REGEX in isolation can't.
describe('Chat terminal link provider (integration)', () => {
  let assistantDataCallback: ((source: string, data: string) => void) | null = null

  beforeEach(() => {
    assistantDataCallback = null
    ;(global as any).window.api = {
      ...(global as any).window.api,
      assistantSpawn: vi.fn(),
      assistantWrite: vi.fn(),
      assistantResize: vi.fn(),
      onAssistantData: vi.fn((cb: (source: string, data: string) => void) => {
        assistantDataCallback = cb
        return () => {}
      }),
      pathExists: vi.fn().mockResolvedValue(false),
      getHomeDir: vi.fn().mockResolvedValue('/Users/thomas'),
    }
    useFileStore.setState({ projectRoot: '/project' })
    useClaudeStore.setState({ assistant: 'claude', restartToken: 0, pendingInjection: null, focusToken: 0 })
  })

  afterEach(() => {
    cleanup()
    useFileStore.setState({ projectRoot: null })
    vi.restoreAllMocks()
  })

  it('registers a link provider that detects an extensionless SSH-key path in real terminal buffer content', async () => {
    const registered: any[] = []
    const spy = vi.spyOn(XTerm.prototype, 'registerLinkProvider').mockImplementation(function (
      this: any,
      provider: any
    ) {
      registered.push(provider)
      return { dispose: () => {} }
    })

    const { container } = render(<Chat />)
    await waitFor(() => {
      if (!container.querySelector('.xterm-helper-textarea')) throw new Error('terminal not mounted yet')
    })

    // Chat.tsx registers exactly two providers for 'claude': the URL one
    // (first, default regex) and the file-path one (second, FILE_PATH_REGEX).
    expect(registered.length).toBe(2)
    const filePathProvider = registered[1]

    // Feed data through the exact same path real PTY output takes, into the
    // SAME xterm instance Chat.tsx registered the provider on — writing into
    // a separately-constructed XTerm would test nothing, since the captured
    // provider closes over Chat.tsx's own internal instance, not a new one.
    expect(assistantDataCallback).not.toBeNull()
    await new Promise<void>((resolve) => {
      assistantDataCallback!('claude', '~/.ssh/id_ed25519_github_personal\r\n')
      // xterm.write() parses the written data asynchronously; give it a tick.
      setTimeout(resolve, 50)
    })

    const links = await new Promise<any[]>((resolve) => {
      filePathProvider.provideLinks(1, (result: any[] | undefined) => resolve(result ?? []))
    })

    expect(links.length).toBeGreaterThan(0)
    expect(links[0].text).toBe('~/.ssh/id_ed25519_github_personal')

    // Closes the loop on the reported symptom end-to-end: activating the
    // link (as a real click would) must resolve the ~/ against the actual
    // home directory and check for the file — not silently no-op.
    await links[0].activate(new MouseEvent('mouseup'), links[0].text)
    expect(window.api.getHomeDir).toHaveBeenCalled()
    expect(window.api.pathExists).toHaveBeenCalledWith('/Users/thomas/.ssh/id_ed25519_github_personal')

    spy.mockRestore()
  })
})
