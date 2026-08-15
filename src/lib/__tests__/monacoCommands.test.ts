import { describe, it, expect, afterEach, vi } from 'vitest'
import { getMonacoCommands } from '../monacoCommands'
import { setLastFocusedEditor } from '../lastFocusedEditor'

function action(id: string, label: string, opts: { isSupported?: boolean } = {}) {
  return {
    id,
    label,
    isSupported: () => opts.isSupported ?? true,
    run: vi.fn().mockResolvedValue(undefined),
  }
}

function fakeEditor(actions: ReturnType<typeof action>[], keybindingLabels: Record<string, string> = {}) {
  return {
    getSupportedActions: () => actions,
    _standaloneKeybindingService: {
      lookupKeybinding: (id: string) => {
        const label = keybindingLabels[id]
        return label ? { getLabel: () => label } : undefined
      },
    },
  } as any
}

afterEach(() => {
  setLastFocusedEditor(null)
})

describe('getMonacoCommands', () => {
  it('returns nothing when no editor has ever been focused', () => {
    expect(getMonacoCommands()).toEqual([])
  })

  it('maps a supported action to a Command prefixed with "Editor: "', () => {
    const addCursorAbove = action('editor.action.insertCursorAbove', 'Add Cursor Above')
    setLastFocusedEditor(fakeEditor([addCursorAbove]))

    const commands = getMonacoCommands()

    expect(commands).toHaveLength(1)
    expect(commands[0].id).toBe('monaco:editor.action.insertCursorAbove')
    expect(commands[0].label).toBe('Editor: Add Cursor Above')

    commands[0].action()
    expect(addCursorAbove.run).toHaveBeenCalled()
  })

  it('excludes actions that report unsupported', () => {
    setLastFocusedEditor(fakeEditor([action('x', 'Unsupported', { isSupported: false })]))
    expect(getMonacoCommands()).toEqual([])
  })

  it('excludes actions with no label', () => {
    setLastFocusedEditor(fakeEditor([action('x', '')]))
    expect(getMonacoCommands()).toEqual([])
  })

  it('excludes "Developer:" debug commands', () => {
    setLastFocusedEditor(fakeEditor([action('editor.action.inspectTokens', 'Developer: Inspect Tokens')]))
    expect(getMonacoCommands()).toEqual([])
  })

  it('excludes editor.action.quickCommand (redundant with the palette itself)', () => {
    setLastFocusedEditor(fakeEditor([action('editor.action.quickCommand', 'Command Palette')]))
    expect(getMonacoCommands()).toEqual([])
  })

  it('includes the resolved keybinding label as shortcut when one exists', () => {
    const changeAll = action('editor.action.changeAll', 'Change All Occurrences')
    setLastFocusedEditor(fakeEditor([changeAll], { 'editor.action.changeAll': '⌘F2' }))

    const commands = getMonacoCommands()

    expect(commands[0].shortcut).toBe('⌘F2')
  })

  it('leaves shortcut unset when the action has no keybinding', () => {
    setLastFocusedEditor(fakeEditor([action('editor.action.foo', 'Foo')]))
    expect(getMonacoCommands()[0].shortcut).toBeUndefined()
  })

  it('leaves shortcut unset (rather than throwing) if the internal keybinding service is unavailable', () => {
    const bare = { getSupportedActions: () => [action('editor.action.foo', 'Foo')] } as any
    setLastFocusedEditor(bare)
    expect(() => getMonacoCommands()).not.toThrow()
    expect(getMonacoCommands()[0].shortcut).toBeUndefined()
  })
})
