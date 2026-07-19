import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePermissions } from "@/hooks/usePermissions";
import type { FeatureFlag, ModuleId, PermissionAction } from "@/types/permissions";

/**
 * <Can /> gates any subtree behind a backend permission. Three modes:
 *   - hidden (default): renders nothing when not allowed
 *   - locked: renders a Lock badge + tooltip
 *   - fallback: renders the provided fallback node
 */
export function Can({
  module,
  action = "view",
  feature,
  mode = "hidden",
  fallback,
  lockedLabel = "Access restricted. Contact your Administrator.",
  children,
}: {
  module?: ModuleId;
  action?: PermissionAction;
  feature?: FeatureFlag;
  mode?: "hidden" | "locked" | "fallback";
  fallback?: ReactNode;
  lockedLabel?: string;
  children: ReactNode;
}) {
  const { can, isLocked, hasFeature } = usePermissions();

  const allowed = feature
    ? hasFeature(feature)
    : module
      ? can(module, action)
      : true;

  if (allowed) return <>{children}</>;

  if (mode === "fallback") return <>{fallback ?? null}</>;

  if (mode === "locked") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border/80 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Locked
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{lockedLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return null;
}

export function LockedBadge({ label = "Access restricted. Contact your Administrator." }: { label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <Lock className="h-3 w-3" />
          Locked
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
