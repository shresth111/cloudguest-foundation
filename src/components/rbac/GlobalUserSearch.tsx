import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRbacUsers } from "@/hooks/useRbac";

interface Props {
  onSelect?: (userId: string) => void;
}

export function GlobalUserSearch({ onSelect }: Props) {
  const { data: users } = useRbacUsers();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query || !users) return [];
    return users.filter((u) => [u.firstName, u.lastName, u.email, u.mobile, u.organizationName, u.roleName, u.departmentName].some((v) => v.toLowerCase().includes(query))).slice(0, 8);
  }, [users, q]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Global user search</h3>
          <p className="text-xs text-muted-foreground">Search by name, email, mobile, organization, role, or department.</p>
        </div>
        <div className="relative">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Try “ava” or “nimbus”…" className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          {q && results.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No matches.</p>}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect?.(u.id)}
              className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-start hover:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: u.avatarColor }}>
                {u.firstName[0]}{u.lastName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.firstName} {u.lastName} · <span className="text-muted-foreground">{u.email}</span></p>
                <p className="truncate text-xs text-muted-foreground">{u.organizationName} · {u.departmentName}</p>
              </div>
              <Badge variant="outline">{u.roleName}</Badge>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
