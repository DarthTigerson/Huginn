const SYSTEM_PROMPT = `You are a code-editing assistant embedded in a code editor. You will be given the code immediately before the target region (<prefix>), the code currently selected within that region (<selection>, which may be empty), the code immediately after it (<suffix>), and an instruction describing the change to make. Respond with ONLY the replacement code — if <selection> is non-empty, respond with the code that should replace it; if <selection> is empty, respond with the code that should be inserted at the cursor. No explanations, no markdown code fences, no repeating unrelated surrounding code.`

export function buildEditSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildEditPrompt(
  prefix: string,
  suffix: string,
  selection: string,
  instruction: string,
  language: string
): string {
  return `Language: ${language}\n<prefix>\n${prefix}\n</prefix>\n<selection>\n${selection}\n</selection>\n<suffix>\n${suffix}\n</suffix>\n\nInstruction: ${instruction}`
}

export type StreamLineEvent =
  | { type: 'delta'; text: string }
  | { type: 'result'; isError: boolean }

export function parseStreamJsonLine(line: string): StreamLineEvent | null {
  let obj: unknown
  try {
    obj = JSON.parse(line)
  } catch {
    return null
  }

  if (!obj || typeof obj !== 'object') return null
  const record = obj as Record<string, unknown>

  if (record.type === 'stream_event') {
    const event = record.event as Record<string, unknown> | undefined
    const delta = event?.delta as Record<string, unknown> | undefined
    if (event?.type === 'content_block_delta' && delta?.type === 'text_delta' && typeof delta.text === 'string') {
      return { type: 'delta', text: delta.text }
    }
    return null
  }

  if (record.type === 'result') {
    return { type: 'result', isError: record.is_error === true }
  }

  return null
}
