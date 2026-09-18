import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /**
   * A second, quieter line under the description, for the case where the
   * emptiness itself needs qualifying -- "this list is empty" and "this list
   * could never contain X" are different claims, and a screen that makes the
   * first while meaning the second is asserting something it has not measured.
   *
   * Optional and rendered only when passed, so every existing caller is
   * byte-identical. `children` is deliberately left where it is (below the
   * action button): it is for extra controls, not for a caveat on the
   * sentence above it.
   */
  note?: ReactNode;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  note,
  action,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {note && (
        <p className="mt-2 max-w-md text-xs text-muted-foreground" data-testid="empty-state-note">
          {note}
        </p>
      )}
      {action && (
        <Button className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
