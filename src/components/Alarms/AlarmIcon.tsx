export function AlarmIcon({ className }: { className?: string } = {}) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="13" r="7.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 9.5V13l2.2 1.6M4.5 4.5 2.8 6.2M19.5 4.5l1.7 1.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
