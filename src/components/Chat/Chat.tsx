export function Chat() {
  return (
    <div className="h-full flex flex-col bg-[#1e1e2e] border-l border-border overflow-hidden">
      <div className="px-4 h-9 flex items-center border-b border-border shrink-0">
        <span className="text-sm font-medium text-gray-200 tracking-wide">Claude</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="text-xs text-gray-600 text-center leading-relaxed">
          Claude integration coming in the next milestone.
        </p>
      </div>
      <div className="p-3 border-t border-border shrink-0">
        <input
          className="w-full bg-white/5 border border-border rounded px-3 py-2 text-sm text-gray-500 placeholder-gray-700 outline-none cursor-not-allowed"
          placeholder="Ask Claude..."
          disabled
        />
      </div>
    </div>
  )
}
