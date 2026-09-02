import { Button } from "@/components/ui/button";

/**
 * Shown when at least one location's resources failed to load.
 *
 * `useWorkspaceScope` aggregates per-location queries with
 * `s.resources?.routers ?? []`, so a location that 403s or 500s contributes
 * nothing and reads exactly like a location that genuinely has no routers
 * and no guests. Without this, four of the five workspace screens reported
 * "No routers in scope." and "0/0" for an outage -- confidently, and with no
 * way to retry.
 */
export function ScopeErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="text-sm">
        Some venues couldn&apos;t be loaded, so the figures below are incomplete.
      </p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
