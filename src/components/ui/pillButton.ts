// Solid fill matching the Commit button's active look — every action pill in
// the Git panel (Branch, Fetch, Pull, Push, Graph, List Diff) shares this
// now, instead of each having its own translucent-gradient-and-ring style.
export const accentSolidColor = 'bg-accent/80 text-on-accent hover:bg-accent'

// The full-width accent pill used for sidebar panel actions (Git's Graph /
// List Diff, the To Do panel's Trash).
export const pillButtonClass =
  `w-full h-7 rounded-full flex items-center justify-center text-[0.625rem] font-bold tracking-tight transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${accentSolidColor}`
