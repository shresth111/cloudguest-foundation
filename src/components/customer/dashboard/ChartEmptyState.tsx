/**
 * Shared empty-state graphic for any chart/table on the customer dashboard
 * with no data yet -- a dormant signal dish, same filled-flat-shape
 * character language as the hero illustration, so "nothing here yet" still
 * feels designed instead of a bare sentence on white. Purely decorative --
 * aria-hidden.
 */
export function ChartEmptyState({
  label,
  action,
}: {
  label: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
      <svg aria-hidden="true" viewBox="0 0 100 70" className="h-14 w-20" fill="none">
        <ellipse cx="50" cy="60" rx="34" ry="4" fill="#6C4EFF" opacity="0.08" />
        <path d="M50 55V30" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="55" r="4" fill="#7c3aed" />
        <path
          d="M28 30a22 22 0 0 1 44 0"
          stroke="#6C4EFF"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.35"
        />
        <circle cx="50" cy="22" r="3" fill="#22d3ee" opacity="0.6" />
      </svg>
      <p className="text-xs text-muted-foreground">{label}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-0.5 inline-flex items-center text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
