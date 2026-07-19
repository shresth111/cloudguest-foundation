import { toast } from "sonner";
import { Laptop, LogOut, Globe, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRbacSessions, useInvalidateRbac } from "@/hooks/useRbac";
import { rbacService } from "@/services/rbac.service";

export function ActiveSessionsPanel() {
  const { data: sessions, isLoading, error } = useRbacSessions();
  const invalidate = useInvalidateRbac();

  const terminate = async (id: string) => { await rbacService.terminateSession(id); toast.success("Session ended"); invalidate("sessions"); };
  const terminateAll = async () => { await rbacService.terminateAllSessions(); toast.success("All other devices signed out"); invalidate("sessions"); };

  if (error) return <Card><CardContent className="p-6 text-sm text-destructive">Failed to load sessions.</CardContent></Card>;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Active sessions</h3>
            <p className="text-xs text-muted-foreground">Devices currently authenticated across the platform.</p>
          </div>
          <Button variant="outline" onClick={terminateAll}><ShieldAlert className="me-1.5 h-4 w-4" /> Sign out all others</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-start">User</th>
                <th className="p-3 text-start">Device</th>
                <th className="p-3 text-start hidden md:table-cell">Browser</th>
                <th className="p-3 text-start hidden lg:table-cell">IP</th>
                <th className="p-3 text-start">Login</th>
                <th className="p-3 text-start">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading || !sessions ? Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t"><td colSpan={7} className="p-3"><Skeleton className="h-10 w-full" /></td></tr>
              )) : sessions.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">{s.userName}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2"><Laptop className="h-4 w-4 text-muted-foreground" /><span>{s.device}</span></div>
                    <p className="text-xs text-muted-foreground">{s.os}</p>
                  </td>
                  <td className="p-3 hidden md:table-cell">{s.browser}</td>
                  <td className="p-3 hidden lg:table-cell text-xs"><span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {s.ipAddress} · {s.location}</span></td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(s.loginAt).toLocaleString()}</td>
                  <td className="p-3">{s.current ? <Badge>Current</Badge> : <Badge variant="secondary">Active</Badge>}</td>
                  <td className="p-3 text-end">
                    <Button size="sm" variant="ghost" disabled={s.current} onClick={() => terminate(s.id)}><LogOut className="me-1 h-3.5 w-3.5" /> Sign out</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
