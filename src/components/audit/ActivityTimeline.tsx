import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { useOrgLocationLookup } from "@/hooks/useMonitoring";
import { useAuditList } from "@/hooks/useAudit";

export function ActivityTimeline() {
  const q = useAuditList({ page: 1, pageSize: 40 });
  const { locationName } = useOrgLocationLookup();
  const rows = q.data?.rows ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Activity timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <LoadingSkeleton rows={6} />
        ) : q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Actions across your platform will appear here."
          />
        ) : (
          <ol className="relative space-y-4 border-l border-border/60 pl-6">
            {rows.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div className="rounded-lg px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{e.action.replace(/_/g, " ")}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {e.entityType}
                    {e.entityId && <span className="font-mono"> · {e.entityId.slice(0, 8)}</span>}
                    {locationName(e.locationId) && <> · {locationName(e.locationId)}</>}
                    {e.actorUserId && (
                      <>
                        {" "}
                        · actor <span className="font-mono">{e.actorUserId.slice(0, 8)}</span>
                      </>
                    )}
                  </div>
                  {e.description && (
                    <div className="text-[11px] text-muted-foreground/80">{e.description}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
