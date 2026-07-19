import { Plus, Users2, Trash2, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRbacGroups, useRbacRoles } from "@/hooks/useRbac";
import { toast } from "sonner";

export function UserGroupsPanel() {
  const { data: groups, isLoading } = useRbacGroups();
  const { data: roles } = useRbacRoles();

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">User groups</h3>
            <p className="text-xs text-muted-foreground">Group teammates to apply permissions and bulk actions.</p>
          </div>
          <Button onClick={() => toast.info("Group creation wizard coming soon")}><Plus className="me-1.5 h-4 w-4" /> New group</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {isLoading || !groups ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />) : groups.map((g) => {
            const role = roles?.find((r) => r.id === g.roleId);
            return (
              <div key={g.id} className="flex h-full flex-col gap-2 rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold flex items-center gap-2"><Users2 className="h-4 w-4 text-primary" /> {g.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
                  </div>
                  <Badge variant="outline">{g.memberIds.length}</Badge>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Role: <span className="text-foreground">{role?.name ?? "—"}</span></span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Manage"><Settings2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
