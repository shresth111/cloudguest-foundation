import { CheckCircle2, XCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRbacLoginHistory } from "@/hooks/useRbac";

export function LoginHistoryPanel() {
  const { data: history, isLoading } = useRbacLoginHistory();

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Login history</h3>
          <p className="text-xs text-muted-foreground">Successful and failed authentication attempts.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-start">User</th>
                <th className="p-3 text-start">Login</th>
                <th className="p-3 text-start hidden md:table-cell">Logout</th>
                <th className="p-3 text-start hidden lg:table-cell">Device</th>
                <th className="p-3 text-start hidden lg:table-cell">IP</th>
                <th className="p-3 text-center">MFA</th>
                <th className="p-3 text-start">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || !history ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t"><td colSpan={7} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
              )) : history.slice(0, 30).map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">{e.userName}</td>
                  <td className="p-3 text-xs">{new Date(e.loginAt).toLocaleString()}</td>
                  <td className="p-3 text-xs hidden md:table-cell">{e.logoutAt ? new Date(e.logoutAt).toLocaleString() : "—"}</td>
                  <td className="p-3 hidden lg:table-cell text-xs">{e.device} · {e.browser}</td>
                  <td className="p-3 hidden lg:table-cell text-xs">{e.ipAddress}</td>
                  <td className="p-3 text-center">{e.mfaUsed ? <ShieldCheck className="mx-auto h-4 w-4 text-emerald-500" /> : <ShieldOff className="mx-auto h-4 w-4 text-muted-foreground" />}</td>
                  <td className="p-3">
                    {e.outcome === "success" ? (
                      <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Success</Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {e.reason ?? "Failed"}</Badge>
                    )}
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
