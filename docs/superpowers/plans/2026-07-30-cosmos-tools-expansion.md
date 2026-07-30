# Cosmos Tool Set Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `CosmosManager`'s tool set with `edit_file`, `create_file`, ranged `read_file`, `glob_search`, a `grep_search` rename, `delete_file`/`move_file`, and a system-prompt priority preamble, so the model prefers targeted edits over full-file rewrites.

**Architecture:** All changes are additive to `electron/cosmos.ts`'s existing `COSMOS_TOOLS` array and `executeTool` switch — no changes to the streaming loop, approval gate, or IPC surface from the already-committed tool-calling foundation. `need-approval`/`tool-call` events already carry the full `args` object, so no new "preview" plumbing is needed: a tool's args ARE its preview (e.g. `edit_file`'s `old_string`/`new_string` show up automatically once the renderer exists).

**Tech Stack:** Electron main process (Node `fs/promises`), Vitest, new dependency: `minimatch`.

## Global Constraints

- `edit_file` requires `old_string` to match exactly once — zero or multiple matches are errors, never partial/fuzzy matching (see spec: "exact substring match only").
- No new diff-algorithm dependency (existing constraint from the 2026-07-28 spec, still applies).
- Match existing test conventions: `getByText`/`toBeTruthy()` where applicable, no `jest-dom` matchers; SSE tool-call tests follow the `toolCallStream`/`finalTextStream` helper pattern already in `electron/__tests__/cosmos.test.ts`.
- Every new test that adds an `it(...)` to the existing `describe('CosmosManager tool calls', ...)` block goes at the end of that block (immediately before its closing `})`), so tasks don't need to track each other's exact insertion point.

---

## Task 1: `edit_file` tool

**Files:**
- Modify: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: nothing new (uses existing `readFile`/`writeFile` imports already in `cosmos.ts`).
- Produces: `edit_file` tool callable by the model with `{ path, old_string, new_string }`.

- [ ] **Step 1: Write the failing tests**

Add these three `it` blocks to the end of the `describe('CosmosManager tool calls', ...)` block in `electron/__tests__/cosmos.test.ts` (immediately before its closing `})`):

```typescript
  it('edit_file replaces a unique old_string with new_string', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'out.txt')
    await writeFileFs(target, 'hello world\nfoo bar\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('edit_file', { path: target, old_string: 'hello world', new_string: 'hello there' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'edit it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('hello there\nfoo bar\n')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool-result', id: 'call_1', isError: false }))
  })

  it('edit_file errors when old_string is not found', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'out.txt')
    await writeFileFs(target, 'hello world\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('edit_file', { path: target, old_string: 'nope', new_string: 'x' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'edit it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('hello world\n')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual({ type: 'tool-result', id: 'call_1', result: `old_string not found in ${target}`, isError: true })
  })

  it('edit_file errors when old_string is not unique', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'out.txt')
    await writeFileFs(target, 'dup\ndup\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('edit_file', { path: target, old_string: 'dup', new_string: 'x' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'edit it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('dup\ndup\n')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual({
      type: 'tool-result',
      id: 'call_1',
      result: `old_string appears 2 times in ${target} — include more surrounding context to make it unique`,
      isError: true,
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: the three new tests FAIL — `Unknown tool: edit_file`.

- [ ] **Step 3: Add the `edit_file` tool schema**

In `electron/cosmos.ts`, in the `COSMOS_TOOLS` array, insert this entry immediately after the `write_file` entry (before the `list_dir` entry):

```typescript
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace an exact, unique occurrence of old_string with new_string in the file at path. Prefer this over write_file for any change to an existing file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
```

- [ ] **Step 4: Add the `edit_file` case to `executeTool`**

In `electron/cosmos.ts`, in the `executeTool` switch, insert this case immediately before the `default:` case:

```typescript
        case 'edit_file': {
          const path = args.path as string
          const oldString = args.old_string as string
          const newString = args.new_string as string
          const content = await readFile(path, 'utf-8')
          const occurrences = content.split(oldString).length - 1
          if (occurrences === 0) {
            return { result: `old_string not found in ${path}`, isError: true }
          }
          if (occurrences > 1) {
            return {
              result: `old_string appears ${occurrences} times in ${path} — include more surrounding context to make it unique`,
              isError: true,
            }
          }
          const updated = content.replace(oldString, newString)
          await writeFile(path, updated, 'utf-8')
          return { result: `Edited ${path}`, isError: false }
        }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit 2>&1 | grep -v "src/types/index.ts\|The file is in the program\|Imported via"`
Expected: no output (the `git.ts` project-file error is pre-existing and unrelated — filtered out here).

- [ ] **Step 7: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "feat: add edit_file tool to CosmosManager"
```

---

## Task 2: `create_file` tool

**Files:**
- Modify: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `create_file` tool callable by the model with `{ path, content }`, distinct from `write_file` — fails if `path` already exists.

- [ ] **Step 1: Write the failing tests**

Add to the end of the `describe('CosmosManager tool calls', ...)` block:

```typescript
  it('create_file creates a new file', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'new.txt')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('create_file', { path: target, content: 'fresh' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'create it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('fresh')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool-result', id: 'call_1', isError: false }))
  })

  it('create_file errors when the file already exists', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'existing.txt')
    await writeFileFs(target, 'already here')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('create_file', { path: target, content: 'overwrite attempt' }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'create it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(target, 'utf-8')).toBe('already here')
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual({
      type: 'tool-result',
      id: 'call_1',
      result: `${target} already exists — use edit_file or write_file`,
      isError: true,
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: the two new tests FAIL — `Unknown tool: create_file`.

- [ ] **Step 3: Add the `create_file` tool schema**

In `electron/cosmos.ts`, in `COSMOS_TOOLS`, insert this entry immediately before the `list_dir` entry (after `edit_file`/`write_file`):

```typescript
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: "Create a new file at an absolute path with the given content. Fails if the file already exists — use edit_file or write_file for existing files.",
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
```

- [ ] **Step 4: Add the `create_file` case to `executeTool`**

In `electron/cosmos.ts`, insert this case immediately before the `default:` case. `writeFile`'s `flag: 'wx'` makes Node itself reject an existing path, so no separate existence check is needed:

```typescript
        case 'create_file': {
          const path = args.path as string
          const content = args.content as string
          try {
            await writeFile(path, content, { encoding: 'utf-8', flag: 'wx' })
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
              return { result: `${path} already exists — use edit_file or write_file`, isError: true }
            }
            throw err
          }
          return { result: `Created ${path}`, isError: false }
        }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit 2>&1 | grep -v "src/types/index.ts\|The file is in the program\|Imported via"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "feat: add create_file tool to CosmosManager"
```

---

## Task 3: `read_file` line-range support

**Files:**
- Modify: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `read_file` now accepts optional `startLine`/`endLine` (1-indexed, inclusive). Omitted → full file, unchanged from current behavior.

- [ ] **Step 1: Write the failing tests**

Add to the end of the `describe('CosmosManager tool calls', ...)` block:

```typescript
  it('read_file returns the full file when no range is given', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'multi.txt')
    await writeFileFs(target, 'line1\nline2\nline3\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('read_file', { path: target }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'read it' }], agentMode: true, settings: SETTINGS })

    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual({ type: 'tool-result', id: 'call_1', result: 'line1\nline2\nline3\n', isError: false })
  })

  it('read_file returns only the requested inclusive line range', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'multi.txt')
    await writeFileFs(target, 'line1\nline2\nline3\nline4\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('read_file', { path: target, startLine: 2, endLine: 3 }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'read it' }], agentMode: true, settings: SETTINGS })

    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual({ type: 'tool-result', id: 'call_1', result: 'line2\nline3', isError: false })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: the range test FAILS (returns the full file instead of the slice); the full-file test already passes (regression guard).

- [ ] **Step 3: Extend the `read_file` case**

In `electron/cosmos.ts`, replace the existing `read_file` case:

```typescript
        case 'read_file': {
          const content = await readFile(args.path as string, 'utf-8')
          return { result: content, isError: false }
        }
```

with:

```typescript
        case 'read_file': {
          const content = await readFile(args.path as string, 'utf-8')
          const { startLine, endLine } = args as { startLine?: number; endLine?: number }
          if (startLine === undefined && endLine === undefined) {
            return { result: content, isError: false }
          }
          const lines = content.split('\n')
          const start = Math.max(1, startLine ?? 1)
          const end = Math.min(lines.length, endLine ?? lines.length)
          return { result: lines.slice(start - 1, end).join('\n'), isError: false }
        }
```

- [ ] **Step 4: Update the `read_file` tool schema**

In `electron/cosmos.ts`, replace:

```typescript
      name: 'read_file',
      description: 'Read the contents of a file at an absolute path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
```

with:

```typescript
      name: 'read_file',
      description: 'Read the contents of a file at an absolute path. Optionally pass startLine/endLine (1-indexed, inclusive) to read only part of a large file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          startLine: { type: 'number' },
          endLine: { type: 'number' },
        },
        required: ['path'],
      },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit 2>&1 | grep -v "src/types/index.ts\|The file is in the program\|Imported via"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "feat: add line-range support to read_file tool"
```

---

## Task 4: Rename `search` to `grep_search`

**Files:**
- Modify: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: `searchText` from `electron/fsOps.ts` (already imported).
- Produces: `grep_search` tool, replacing `search` (not committed anywhere else yet, so this is a clean rename with no back-compat concern).

- [ ] **Step 1: Write the failing test**

Add to the end of the `describe('CosmosManager tool calls', ...)` block:

```typescript
  it('grep_search finds text matches under a root path', async () => {
    const { win, sendHandler } = setup()
    await writeFileFs(join(root, 'a.txt'), 'needle here\nother line\n')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('grep_search', { root, query: 'needle', caseSensitive: true }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'search it' }], agentMode: true, settings: SETTINGS })

    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    const result = events.find((e: any) => e.type === 'tool-result')
    expect(JSON.parse(result.result)).toEqual([{ path: join(root, 'a.txt'), line: 1, col: 1, text: 'needle here' }])
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: FAILS — `Unknown tool: grep_search`.

- [ ] **Step 3: Rename the tool schema**

In `electron/cosmos.ts`, replace:

```typescript
      name: 'search',
      description: 'Search for a text query across all files under an absolute root path.',
```

with:

```typescript
      name: 'grep_search',
      description: 'Search for a text query across all files under an absolute root path.',
```

- [ ] **Step 4: Rename the `executeTool` case**

In `electron/cosmos.ts`, replace:

```typescript
        case 'search': {
          const matches = await searchText(args.root as string, args.query as string, Boolean(args.caseSensitive))
          return { result: JSON.stringify(matches), isError: false }
        }
```

with:

```typescript
        case 'grep_search': {
          const matches = await searchText(args.root as string, args.query as string, Boolean(args.caseSensitive))
          return { result: JSON.stringify(matches), isError: false }
        }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit 2>&1 | grep -v "src/types/index.ts\|The file is in the program\|Imported via"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "refactor: rename Cosmos search tool to grep_search"
```

---

## Task 5: `glob_search` tool

**Files:**
- Modify: `electron/cosmos.ts`
- Modify: `package.json`, `package-lock.json`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: `listAllFiles` from `electron/fsOps.ts` (already imported), `minimatch` from the new `minimatch` dependency.
- Produces: `glob_search` tool callable by the model with `{ pattern, root? }`.

- [ ] **Step 1: Install the dependency**

Run: `npm install minimatch`

- [ ] **Step 2: Write the failing test**

Add to the end of the `describe('CosmosManager tool calls', ...)` block:

```typescript
  it('glob_search matches files by pattern under root', async () => {
    const { win, sendHandler } = setup()
    await mkdir(join(root, 'sub'))
    await writeFileFs(join(root, 'a.ts'), '')
    await writeFileFs(join(root, 'b.txt'), '')
    await writeFileFs(join(root, 'sub', 'c.ts'), '')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('glob_search', { pattern: '**/*.ts', root }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'find ts files' }], agentMode: true, settings: SETTINGS })

    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    const result = events.find((e: any) => e.type === 'tool-result')
    expect(JSON.parse(result.result).sort()).toEqual([join(root, 'a.ts'), join(root, 'sub', 'c.ts')].sort())
  })
```

This test uses `mkdir`, which is not yet imported in the test file — add it to the existing `fs/promises` import line (`import { mkdtemp, writeFile as writeFileFs, readFile as readFileFs, rm } from 'fs/promises'` → add `mkdir`).

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: FAILS — `Unknown tool: glob_search`.

- [ ] **Step 4: Add the `glob_search` import**

In `electron/cosmos.ts`, add to the top of the file, after the existing `import { listAllFiles, searchText, buildTree } from './fsOps'` line:

```typescript
import { minimatch } from 'minimatch'
```

- [ ] **Step 5: Add the `glob_search` tool schema**

In `electron/cosmos.ts`, in `COSMOS_TOOLS`, insert this entry immediately after the `grep_search` entry (before `run_command`):

```typescript
  {
    type: 'function',
    function: {
      name: 'glob_search',
      description: 'Find files whose path matches a glob pattern (e.g. "**/*.ts") under an absolute root path.',
      parameters: {
        type: 'object',
        properties: { pattern: { type: 'string' }, root: { type: 'string' } },
        required: ['pattern', 'root'],
      },
    },
  },
```

- [ ] **Step 6: Add the `glob_search` case to `executeTool`**

In `electron/cosmos.ts`, insert this case immediately before the `default:` case:

```typescript
        case 'glob_search': {
          const root = args.root as string
          const pattern = args.pattern as string
          const allFiles = await listAllFiles(root)
          const matches = allFiles.filter((f) => minimatch(f.slice(root.length + 1), pattern))
          return { result: JSON.stringify(matches), isError: false }
        }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit 2>&1 | grep -v "src/types/index.ts\|The file is in the program\|Imported via"`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts package.json package-lock.json
git commit -m "feat: add glob_search tool to CosmosManager"
```

---

## Task 6: `delete_file` and `move_file` tools

**Files:**
- Modify: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: nothing new (`unlink`/`rename` from `fs/promises`, added to the existing import in this task).
- Produces: `delete_file({ path })` and `move_file({ from, to })` tools.

- [ ] **Step 1: Write the failing tests**

Add to the end of the `describe('CosmosManager tool calls', ...)` block:

```typescript
  it('delete_file removes the file', async () => {
    const { win, sendHandler } = setup()
    const target = join(root, 'gone.txt')
    await writeFileFs(target, 'bye')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('delete_file', { path: target }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'delete it' }], agentMode: true, settings: SETTINGS })

    await expect(readFileFs(target, 'utf-8')).rejects.toThrow()
    const events = win.webContents.send.mock.calls.filter((c: any[]) => c[0] === 'cosmos:event').map((c: any[]) => c[1])
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool-result', id: 'call_1', isError: false }))
  })

  it('move_file renames the file', async () => {
    const { win, sendHandler } = setup()
    const from = join(root, 'old.txt')
    const to = join(root, 'new.txt')
    await writeFileFs(from, 'content')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(toolCallStream('move_file', { from, to }))
      .mockResolvedValueOnce(finalTextStream('done'))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: root, messages: [{ role: 'user', content: 'move it' }], agentMode: true, settings: SETTINGS })

    expect(await readFileFs(to, 'utf-8')).toBe('content')
    await expect(readFileFs(from, 'utf-8')).rejects.toThrow()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: FAIL — `Unknown tool: delete_file` / `Unknown tool: move_file`.

- [ ] **Step 3: Extend the `fs/promises` import**

In `electron/cosmos.ts`, replace:

```typescript
import { readFile, writeFile } from 'fs/promises'
```

with:

```typescript
import { readFile, writeFile, unlink, rename } from 'fs/promises'
```

- [ ] **Step 4: Add the tool schemas**

In `electron/cosmos.ts`, in `COSMOS_TOOLS`, insert these two entries at the end of the array (after `run_command`, still before `] as const`):

```typescript
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete the file at an absolute path.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_file',
      description: 'Rename or move a file from one absolute path to another.',
      parameters: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' } },
        required: ['from', 'to'],
      },
    },
  },
```

- [ ] **Step 5: Add the `executeTool` cases**

In `electron/cosmos.ts`, insert these cases immediately before the `default:` case:

```typescript
        case 'delete_file': {
          const path = args.path as string
          await unlink(path)
          return { result: `Deleted ${path}`, isError: false }
        }
        case 'move_file': {
          const from = args.from as string
          const to = args.to as string
          await rename(from, to)
          return { result: `Moved ${from} to ${to}`, isError: false }
        }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: all tests PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit 2>&1 | grep -v "src/types/index.ts\|The file is in the program\|Imported via"`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "feat: add delete_file and move_file tools to CosmosManager"
```

---

## Task 7: System prompt priority preamble

**Files:**
- Modify: `electron/cosmos.ts`
- Test: `electron/__tests__/cosmos.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `runConversation` now prepends a fixed `system` message to the outgoing message list (only if the caller didn't already supply one), stating the edit_file > write_file > create_file priority order.

- [ ] **Step 1: Write the failing test**

Add a new top-level `describe` block at the end of `electron/__tests__/cosmos.test.ts`:

```typescript
describe('CosmosManager system prompt', () => {
  beforeEach(() => vi.restoreAllMocks())

  function setup() {
    const win = { webContents: { send: vi.fn() } } as any
    const manager = new CosmosManager(win)
    manager.registerHandlers()
    return handlers['cosmos:send']
  }

  it('prepends the tool-priority system message when none is present', async () => {
    const sendHandler = setup()
    const fetchMock = vi.fn().mockResolvedValueOnce(sseStream(['data: [DONE]\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, { cwd: '/project', messages: [{ role: 'user', content: 'hi' }], agentMode: false, settings: SETTINGS })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toContain('edit_file')
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hi' })
  })

  it('does not duplicate the system message if one is already present', async () => {
    const sendHandler = setup()
    const fetchMock = vi.fn().mockResolvedValueOnce(sseStream(['data: [DONE]\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    await sendHandler({}, {
      cwd: '/project',
      messages: [{ role: 'system', content: 'custom' }, { role: 'user', content: 'hi' }],
      agentMode: false,
      settings: SETTINGS,
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages).toEqual([{ role: 'system', content: 'custom' }, { role: 'user', content: 'hi' }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: FAIL — no system message is currently prepended.

- [ ] **Step 3: Widen `CosmosRole` to include `'system'`**

`CosmosRole` is currently `'user' | 'assistant' | 'tool'`, which doesn't allow a `system` message. In `electron/cosmos.ts`, replace:

```typescript
export type CosmosRole = 'user' | 'assistant' | 'tool'
```

with:

```typescript
export type CosmosRole = 'system' | 'user' | 'assistant' | 'tool'
```

- [ ] **Step 4: Add the preamble constant and prepend logic**

In `electron/cosmos.ts`, add this constant near the top of the file, after the `MAX_TOOL_ROUNDS` constant:

```typescript
const TOOL_PRIORITY_SYSTEM_PROMPT =
  'When modifying an existing file, prefer edit_file over write_file. Full-file rewrites waste tokens, fail on large files, and risk changing untouched code. ' +
  'Use this priority order: (1) edit_file for any change to an existing file, (2) write_file only for complete rewrites explicitly requested by the user, ' +
  "(3) create_file only for files that don't exist yet."
```

Then, in `runConversation`, replace:

```typescript
  private async runConversation(payload: CosmosSendPayload): Promise<void> {
    const { cwd, settings, agentMode } = payload
    const messages = [...payload.messages]
```

with:

```typescript
  private async runConversation(payload: CosmosSendPayload): Promise<void> {
    const { cwd, settings, agentMode } = payload
    const messages = [...payload.messages]
    if (messages[0]?.role !== 'system') {
      messages.unshift({ role: 'system', content: TOOL_PRIORITY_SYSTEM_PROMPT })
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run electron/__tests__/cosmos.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -p tsconfig.node.json --noEmit 2>&1 | grep -v "src/types/index.ts\|The file is in the program\|Imported via"`
Expected: no output.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS (no regressions elsewhere).

- [ ] **Step 8: Commit**

```bash
git add electron/cosmos.ts electron/__tests__/cosmos.test.ts
git commit -m "feat: prepend tool-priority system prompt to Cosmos conversations"
```
