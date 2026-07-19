import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuditLive } from "@/hooks/useAudit";
import { CATEGORY_ICON, SeverityBadge, relativeTime, humanAction } from "./audit-utils";

interface Props { onOpenDetails: (id: string) => void }

export function LiveActivityFeed({ onOpenDetails }: Props) {
  const q = useAuditLive();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [q.dataUpdatedAt]);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live activity
        </CardTitle>
        <Badge variant="secondary" className="gap-1"><Radio className="h-3 w-3" /> streaming</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          <div ref={ref} className="divide-y divide-border/60 px-4">
            <AnimatePresence initial={false}>
              {(q.data ?? []).map((e) => {
                const Icon = CATEGORY_ICON[e.category];
                return (
                  <motion.button
                    layout
                    key={e.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => onOpenDetails(e.id)}
                    className="w-full py-3 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium capitalize">{humanAction(e.action)}</span>
                          <SeverityBadge severity={e.severity} />
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground truncate">
                          {e.actor.name} · {e.organizationName}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{relativeTime(e.timestamp)}</span>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
