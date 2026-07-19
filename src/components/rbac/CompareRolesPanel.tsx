import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { useRbacRoles } from "@/hooks/useRbac";
import { PERMISSION_ACTIONS, RBAC_MODULES } from "@/types/rbac";
import { cn } from "@/lib/utils";

export function CompareRolesPanel() {
  const { data: roles } = useRbacRoles();
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  const roleA = useMemo(() => roles?.find((r) => r.id === a), [roles, a]);
  const roleB = useMemo(() => roles?.find((r) => r.id === b), [roles, b]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Role A</p>
            <Select value={a} onValueChange={setA}>
              <SelectTrigger><SelectValue placeholder="Select first role" /></SelectTrigger>
              <SelectContent>{roles?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Role B</p>
            <Select value={b} onValueChange={setB}>
              <SelectTrigger><SelectValue placeholder="Select second role" /></SelectTrigger>
              <SelectContent>{roles?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {!roleA || !roleB ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Select two roles to compare.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-start">Module / Action</th>
                  <th className="p-2 text-center">{roleA.name}</th>
                  <th className="p-2 text-center">{roleB.name}</th>
                  <th className="p-2 text-center">Diff</th>
                </tr>
              </thead>
              <tbody>
                {RBAC_MODULES.flatMap((m) => PERMISSION_ACTIONS.map((act) => {
                  const av = !!roleA.permissions[m.key]?.[act];
                  const bv = !!roleB.permissions[m.key]?.[act];
                  if (!av && !bv) return null;
                  const diff = av !== bv;
                  return (
                    <tr key={`${m.key}-${act}`} className={cn("border-t", diff && "bg-amber-500/5")}>
                      <td className="p-2">{m.label} · <span className="capitalize text-muted-foreground">{act}</span></td>
                      <td className="p-2 text-center">{av ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-500" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground" />}</td>
                      <td className="p-2 text-center">{bv ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-500" /> : <X className="mx-auto h-3.5 w-3.5 text-muted-foreground" />}</td>
                      <td className="p-2 text-center">{diff ? <Badge variant="outline" className="text-amber-500 border-amber-500/40">differs</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
