import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuditByActions } from "@/hooks/useAudit";
import type { AuditAction } from "@/types/audit";
import { SeverityBadge, StatusBadge, formatTimestamp, humanAction } from "./audit-utils";

interface Props {
  title: string;
  description?: string;
  actions: AuditAction[];
  onOpenDetails: (id: string) => void;
}

export function EventList({ title, description, actions, onOpenDetails }: Props) {
  const q = useAuditByActions(actions);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        {q.isLoading ? <LoadingSkeleton rows={5} /> :
         q.isError ? <ErrorState onRetry={() => q.refetch()} /> :
         !q.data?.length ? <EmptyState title="No events" description="Nothing recorded in this category yet." /> : (
          <ul className="divide-y divide-border/60">
            {q.data.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => onOpenDetails(e.id)}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-card/40 rounded-md transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium capitalize">{humanAction(e.action)}</span>
                      <SeverityBadge severity={e.severity} />
                      <StatusBadge status={e.status} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {e.actor.name} · {e.organizationName} · <span className="font-mono">{e.context.ipAddress}</span>
                    </div>
                  </div>
                  <div className="hidden sm:block text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(e.timestamp)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
