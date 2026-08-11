import type * as monacoEditor from 'monaco-editor'

// Editor.tsx mounts `<MonacoEditor>` without a `path` prop (see Editor.tsx),
// so every model gets an anonymous `inmemory://model/N` URI rather than one
// reflecting the real file path — `model.uri` can't be used to recover which
// file a model belongs to. A WeakMap keyed by the model instance sidesteps
// that without touching Monaco's model creation/disposal lifecycle at all:
// entries are dropped automatically when a model is garbage collected, same
// as today.
const pathByModel = new WeakMap<monacoEditor.editor.ITextModel, string>()

export function registerModelPath(model: monacoEditor.editor.ITextModel, path: string): void {
  pathByModel.set(model, path)
}

export function pathForModel(model: monacoEditor.editor.ITextModel): string | undefined {
  return pathByModel.get(model)
}
