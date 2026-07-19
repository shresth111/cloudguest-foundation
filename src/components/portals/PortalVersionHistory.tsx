import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRestoreVersion } from "@/hooks/usePortals";
import type { Portal } from "@/types/portal";
import { PortalStatusBadge } from "./PortalBadges";

export function PortalVersionHistory({ portal }: { portal: Portal }) {
  const restore = useRestoreVersion(portal.id);
  const sorted = [...portal.versions].sort((a, b) => b.version - a.version);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4" /> Version history
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-4 border-l pl-6">
          {sorted.map((v) => (
            <li key={v.id} className="relative">
              <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                <span className="h-2 w-2 rounded-full bg-primary" />
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-medium">v{v.version} — {v.label}</div>
                <PortalStatusBadge status={v.status} />
                {portal.currentVersion === v.version && <Badge variant="secondary">Current</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(v.createdAt).toLocaleString()} · {v.createdBy}
              </div>
              {v.notes && <p className="mt-1 text-xs text-muted-foreground">{v.notes}</p>}
              {portal.currentVersion !== v.version && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => restore.mutate(v.id)}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restore this version
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
