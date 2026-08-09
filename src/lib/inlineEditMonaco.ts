// src/lib/inlineEditMonaco.ts
import { useInlineEditStore, type InlineEditTarget } from '@/stores/inlineEditStore'
import { useInlineEditSettingsStore } from '@/stores/inlineEditSettingsStore'
import { getCompletionContext } from './autocompleteContext'
import { startInlineEdit, cancelInlineEdit, subscribeToInlineEditEvents } from './inlineEditClient'
import type * as Monaco from 'monaco-editor'

// Bounds the size of the <selection> block sent to `claude -p`. Unlike
// prefix/suffix (capped at 4000/2000 chars via getCompletionContext), the
// selection itself was previously uncapped — a "select all, Cmd+K" on a
// large file could put the whole file into a single argv element, risking
// an ARG_MAX spawn failure and, well below that threshold, silently burning
// significant subscription quota on an oversized request. Selections over
// this cap are rejected before any request is sent (see submit()).
const MAX_SELECTION_CHARS = 4000

function postProcessEditText(raw: string): string {
  let text = raw.trim()
  if (!text) return text

  const fenced = text.match(/```[a-zA-Z0-9]*\n([\s\S]*?)\n?```/)
  if (fenced) text = fenced[1].trim()

  return text
}

export function registerInlineEditCommands(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco
): void {
  subscribeToInlineEditEvents()

  let promptWidget: Monaco.editor.IContentWidget | null = null
  let decorationIds: string[] = []
  let viewZoneId: string | null = null

  function targetRange(target: InlineEditTarget): Monaco.Range {
    return new monaco.Range(target.startLineNumber, target.startColumn, target.endLineNumber, target.endColumn)
  }

  function closePromptWidget() {
    if (!promptWidget) return
    editor.removeContentWidget(promptWidget)
    promptWidget = null
  }

  function clearDecorations() {
    decorationIds = editor.deltaDecorations(decorationIds, [])
  }

  function clearViewZone() {
    if (viewZoneId === null) return
    const id = viewZoneId
    viewZoneId = null
    editor.changeViewZones((accessor) => accessor.removeZone(id))
  }

  function renderZone(target: InlineEditTarget, text: string, isError: boolean) {
    const domNode = document.createElement('div')
    domNode.className = isError
      ? 'px-2 py-1 text-sm font-mono whitespace-pre-wrap bg-panel border-l-2 border-red-500 text-red-400'
      : 'px-2 py-1 text-sm font-mono whitespace-pre-wrap bg-panel border-l-2 border-accent text-fg'
    const displayText = text.length > 0 ? text : '…'
    domNode.textContent = displayText

    editor.changeViewZones((accessor) => {
      if (viewZoneId !== null) accessor.removeZone(viewZoneId)
      viewZoneId = accessor.addZone({
        afterLineNumber: target.endLineNumber,
        heightInLines: Math.max(1, displayText.split('\n').length),
        domNode,
      })
    })
  }

  function teardown() {
    closePromptWidget()
    clearDecorations()
    clearViewZone()
    editor.updateOptions({ readOnly: false })
  }

  function openPromptWidget(target: InlineEditTarget) {
    const container = document.createElement('div')
    container.className = 'bg-popover border border-border rounded-lg shadow-lg shadow-black/40 p-1.5 flex items-center gap-1.5'
    container.style.width = '360px'

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Describe the change…'
    input.className = 'flex-1 bg-bg border border-border rounded px-2 py-1 text-sm text-fg focus:outline-none focus:border-accent/60'
    container.appendChild(input)

    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        const instruction = input.value.trim()
        if (!instruction) return
        submit(target, instruction)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closePromptWidget()
        useInlineEditStore.getState().closePrompt()
      }
    })

    const widget: Monaco.editor.IContentWidget = {
      getId: () => 'huginn.inlineEdit.prompt',
      getDomNode: () => container,
      getPosition: () => ({
        position: { lineNumber: target.startLineNumber, column: target.startColumn },
        preference: [
          monaco.editor.ContentWidgetPositionPreference.ABOVE,
          monaco.editor.ContentWidgetPositionPreference.BELOW,
        ],
      }),
    }

    promptWidget = widget
    editor.addContentWidget(widget)
    requestAnimationFrame(() => input.focus())
  }

  function submit(target: InlineEditTarget, instruction: string) {
    closePromptWidget()

    const model = editor.getModel()
    if (!model) return

    const range = targetRange(target)
    const selection = model.getValueInRange(range)

    // Reject oversized selections before spawning anything — see
    // MAX_SELECTION_CHARS above. Mirrors the Escape-key behavior (silently
    // close the prompt, widget already closed above) since this is a
    // pre-flight validation failure, not a mid-generation one, so it doesn't
    // go through the fail()/error-display path built for the latter.
    if (selection.length > MAX_SELECTION_CHARS) {
      useInlineEditStore.getState().closePrompt()
      return
    }

    const { prefix } = getCompletionContext(model, {
      lineNumber: target.startLineNumber,
      column: target.startColumn,
    })
    const { suffix } = getCompletionContext(model, {
      lineNumber: target.endLineNumber,
      column: target.endColumn,
    })
    const language = model.getLanguageId()
    const selectedModel = useInlineEditSettingsStore.getState().model

    if (selection.length > 0) {
      decorationIds = editor.deltaDecorations(decorationIds, [{
        range,
        options: { inlineClassName: 'inline-edit-removed' },
      }])
    }

    editor.updateOptions({ readOnly: true })

    startInlineEdit({ prefix, suffix, selection, instruction, language, model: selectedModel })
  }

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    if (!useInlineEditSettingsStore.getState().enabled) return
    if (useInlineEditStore.getState().status !== 'idle') {
      cancelInlineEdit()
    }

    const selection = editor.getSelection()
    if (!selection) return

    const target: InlineEditTarget = {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    }

    useInlineEditStore.getState().openPrompt(editor, target)
    openPromptWidget(target)
  })

  function acceptEdit() {
    const state = useInlineEditStore.getState()
    if (!state.target) return
    editor.updateOptions({ readOnly: false })
    editor.executeEdits('inline-edit', [{ range: targetRange(state.target), text: postProcessEditText(state.accumulatedText) }])
    state.reset()
  }

  editor.onKeyDown((e) => {
    const state = useInlineEditStore.getState()
    if (state.owner !== editor) return

    if (state.status === 'reviewing' && e.keyCode === monaco.KeyCode.Enter) {
      e.preventDefault()
      // Also stop propagation: this IKeyboardEvent wraps the same browser
      // event Monaco's own keybinding service dispatches from, and its own
      // Enter-inserts-newline command could otherwise still fire alongside
      // acceptEdit() below, inserting a stray newline into the document.
      e.stopPropagation()
      acceptEdit()
    } else if (state.status === 'generating' && e.keyCode === monaco.KeyCode.Escape) {
      e.preventDefault()
      cancelInlineEdit()
    } else if ((state.status === 'reviewing' || state.status === 'error') && e.keyCode === monaco.KeyCode.Escape) {
      e.preventDefault()
      useInlineEditStore.getState().reset()
    }
  })

  const unsubscribe = useInlineEditStore.subscribe((state) => {
    if (state.owner !== editor || state.status === 'idle') {
      teardown()
      return
    }
    if (!state.target || state.status === 'prompting') return

    if (state.status === 'error') {
      renderZone(state.target, `${state.errorMessage ?? 'Something went wrong'} (Esc to dismiss)`, true)
    } else {
      renderZone(state.target, state.accumulatedText, false)
    }
  })

  editor.onDidDispose(() => {
    unsubscribe()
    if (useInlineEditStore.getState().owner === editor) {
      cancelInlineEdit()
    }
  })
}
