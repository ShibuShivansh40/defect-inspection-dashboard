/** Brand mark: a scan frame with a defect marker. Same drawing as public/favicon.svg. */
export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" className="fill-raised" />
      <rect x="7" y="7" width="18" height="18" rx="3" strokeWidth="2" className="stroke-accent" />
      <path d="M7 16h18" strokeWidth="2" strokeDasharray="3 2" className="stroke-accent" />
      <circle cx="21" cy="11" r="2" className="fill-bad" />
    </svg>
  );
}
