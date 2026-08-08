const SYSTEM_PROMPT = `You are a code-completion engine embedded in a code editor. You will be given the code immediately before the cursor (<prefix>) and immediately after the cursor (<suffix>). Respond with ONLY the exact text that should be inserted at the cursor to continue the code naturally — no explanations, no markdown code fences, no repeating text that already appears in the prefix or suffix. If no reasonable completion exists, respond with nothing.`

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildUserPrompt(prefix: string, suffix: string, language: string): string {
  return `Language: ${language}\n<prefix>\n${prefix}\n</prefix>\n<suffix>\n${suffix}\n</suffix>`
}

export function postProcessCompletion(raw: string): string | null {
  let text = raw.trim()
  if (!text) return null

  const fenced = text.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n?```$/)
  if (fenced) text = fenced[1].trim()

  return text.length > 0 ? text : null
}
