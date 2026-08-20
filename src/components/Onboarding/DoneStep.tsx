export function DoneStep() {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-6">
      <h1 className="text-lg font-semibold text-fg">All set</h1>
      <p className="text-sm text-fg-muted max-w-sm">
        Open a project to get started. You can revisit any of this later in Settings — including
        replaying this wizard from Settings → General.
      </p>
    </div>
  )
}
