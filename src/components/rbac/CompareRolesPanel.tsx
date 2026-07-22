import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { useRbacPermissions, useRbacRoles } from "@/hooks/useRbac";
import { cn } from "@/lib/utils";

export function CompareRolesPanel() {
  const { data: roles } = useRbacRoles();
  const { data: permissions = [] } = useRbacPermissions();
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  const roleA = useMemo(() => roles?.find((r) => r.id === a), [roles, a]);
  const roleB = useMemo(() => roles?.find((r) => r.id === b), [roles, b]);

  const rows = useMemo(() => {
    if (!roleA || !roleB) return [];
    const setA_ = new Set(roleA.permissions);
    const setB_ = new Set(roleB.permissions);
    return permissions
      .filter((p) => setA_.has(p.key) || setB_.has(p.key))
      .map((p) => ({
        key: p.key,
        label: `${p.name} · ${p.action}`,
        inA: setA_.has(p.key),
        inB: setB_.has(p.key),
      }));
  }, [roleA, roleB, permissions]);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Role A</p>
            <Select value={a} onValueChange={setA}>
              <SelectTrigger>
                <SelectValue placeholder="Select first role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Role B</p>
            <Select value={b} onValueChange={setB}>
              <SelectTrigger>
                <SelectValue placeholder="Select second role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!roleA || !roleB ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Select two roles to compare.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Neither role has any permissions granted.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-start">Permission</th>
                  <th className="p-2 text-center">{roleA.name}</th>
                  <th className="p-2 text-center">{roleB.name}</th>
                  <th className="p-2 text-center">Diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const diff = row.inA !== row.inB;
                  return (
                    <tr key={row.key} className={cn("border-t", diff && "bg-amber-500/5")}>
                      <td className="p-2">{row.label}</td>
                      <td className="p-2 text-center">
                        {row.inA ? (
                          <Check className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <X className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {row.inB ? (
                          <Check className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <X className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {diff ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                            differs
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
