export function RadioGroup<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  ariaLabel?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-border overflow-hidden">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={[
              'px-3 py-1.5 text-sm transition-colors',
              active ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg hover:bg-white/5',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
