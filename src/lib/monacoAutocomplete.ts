import { getCompletionContext, type PositionLike, type TextModelLike } from './autocompleteContext'
import { isAutocompleteEffectivelyEnabled } from './autocompleteEffectiveState'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'

const DEBOUNCE_MS = 700

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface CancellationTokenLike {
  isCancellationRequested: boolean
}

export interface InlineCompletionItem {
  insertText: string
  range: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
}

type LanguageAwareModel = TextModelLike & { getLanguageId(): string }

export async function provideInlineCompletion(
  model: LanguageAwareModel,
  position: PositionLike,
  token: CancellationTokenLike
): Promise<InlineCompletionItem[]> {
  if (!isAutocompleteEffectivelyEnabled()) return []

  await sleep(DEBOUNCE_MS)
  if (token.isCancellationRequested || !isAutocompleteEffectivelyEnabled()) return []

  const { prefix, suffix } = getCompletionContext(model, position)
  const language = model.getLanguageId()
  const selectedModel = useAutocompleteSettingsStore.getState().model

  useAutocompleteStatusStore.getState().setBusy(true)
  let text: string | null
  try {
    text = await window.api.autocompleteComplete(prefix, suffix, language, selectedModel)
  } catch {
    return []
  } finally {
    useAutocompleteStatusStore.getState().setBusy(false)
  }

  if (!text || token.isCancellationRequested) return []

  return [{
    insertText: text,
    range: {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    },
  }]
}

let registered = false

export function registerAutocompleteProvider(monaco: typeof import('monaco-editor')): void {
  if (registered) return
  registered = true

  monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: async (model, position, _context, token) => ({
      items: await provideInlineCompletion(model as unknown as LanguageAwareModel, position, token),
    }),
    disposeInlineCompletions: () => {},
  })
}
