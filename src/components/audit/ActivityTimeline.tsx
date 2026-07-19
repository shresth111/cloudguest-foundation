import { motion } from "framer-motion";
import { useAuditTimeline } from "@/hooks/useAudit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { CATEGORY_ICON, SeverityBadge, StatusBadge, formatTimestamp, humanAction, relativeTime } from "./audit-utils";

interface Props { onOpenDetails: (id: string) => void }

export function ActivityTimeline({ onOpenDetails }: Props) {
  const q = useAuditTimeline(40);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base">Activity timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <LoadingSkeleton rows={6} /> :
         q.isError ? <ErrorState onRetry={() => q.refetch()} /> :
         !q.data || q.data.length === 0 ? <EmptyState title="No activity yet" description="Actions across your platform will appear here." /> : (
          <ol className="relative space-y-4 border-l border-border/60 pl-6">
            {q.data.map((e, i) => {
              const Icon = CATEGORY_ICON[e.category];
              return (
                <motion.li
                  key={e.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2 }}
                  className="relative"
                >
                  <span className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <button
                    onClick={() => onOpenDetails(e.id)}
                    className="w-full text-left rounded-lg border border-transparent px-2 py-1.5 hover:border-border/60 hover:bg-card/40 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium capitalize">{humanAction(e.action)}</span>
                      <SeverityBadge severity={e.severity} />
                      <StatusBadge status={e.status} />
                      <span className="ml-auto text-[11px] text-muted-foreground">{relativeTime(e.timestamp)}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <span className="text-foreground">{e.actor.name}</span> · {e.organizationName}
                      {e.locationName && <> · {e.locationName}</>} · <span className="font-mono">{e.context.ipAddress}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground/80">{formatTimestamp(e.timestamp)}</div>
                  </button>
                </motion.li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
