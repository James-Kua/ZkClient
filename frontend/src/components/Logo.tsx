// A small node-graph mark: one root fanning out to three children.
export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M16 10v5M16 15l-7 6M16 15v6M16 15l7 6" stroke="var(--accent-contrast)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="9" r="2.6" fill="var(--accent-contrast)" />
      <circle cx="9" cy="22" r="2.2" fill="var(--accent-contrast)" />
      <circle cx="16" cy="22" r="2.2" fill="var(--accent-contrast)" />
      <circle cx="23" cy="22" r="2.2" fill="var(--accent-contrast)" />
    </svg>
  );
}
