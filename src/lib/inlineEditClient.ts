import { useInlineEditStore } from '@/stores/inlineEditStore'

let nextRequestId = 0

function generateRequestId(): string {
  nextRequestId += 1
  return `inline-edit-${Date.now()}-${nextRequestId}`
}

let subscribed = false

export function subscribeToInlineEditEvents(): void {
  if (subscribed) return
  subscribed = true

  window.api.onInlineEditEvent((event) => {
    const store = useInlineEditStore.getState()
    if (event.type === 'delta') store.appendDelta(event.requestId, event.text)
    else if (event.type === 'done') store.finishGenerating(event.requestId)
    else store.fail(event.requestId, event.message)
  })
}

export function startInlineEdit(params: {
  prefix: string
  suffix: string
  selection: string
  instruction: string
  language: string
  model: string
}): void {
  const requestId = generateRequestId()
  useInlineEditStore.getState().startGenerating(requestId)
  window.api.inlineEditStart({
    requestId,
    prefix: params.prefix,
    suffix: params.suffix,
    selection: params.selection,
    instruction: params.instruction,
    language: params.language,
    model: params.model,
  })
}

export function cancelInlineEdit(): void {
  window.api.inlineEditCancel()
  useInlineEditStore.getState().reset()
}

export function _resetInlineEditClientForTesting(): void {
  subscribed = false
}
