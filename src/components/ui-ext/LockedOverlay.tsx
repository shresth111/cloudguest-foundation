import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LockedOverlayProps {
  label?: string;
  hint?: string;
  className?: string;
}

/**
 * Overlay used to disable feature panels the current user cannot
 * access. Renders a soft blurred veil with a padlock and a clear
 * "Access restricted" message so the surface still communicates
 * what's behind the wall.
 */
export function LockedOverlay({
  label = "Access restricted",
  hint = "Contact your administrator to unlock this module.",
  className,
}: LockedOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2",
        "rounded-[inherit] bg-background/70 text-center backdrop-blur-md",
        className,
      )}
      role="status"
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground shadow-sm">
        <Lock className="h-4 w-4" />
      </div>
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="max-w-xs text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
