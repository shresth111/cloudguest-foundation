import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRbacUsers } from "@/hooks/useRbac";

interface Props {
  onSelect?: (userId: string) => void;
}

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function GlobalUserSearch({ onSelect }: Props) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useRbacUsers({
    page: 1,
    pageSize: 10,
    search: q.trim() || undefined,
  });
  const results = q.trim() ? (data?.items ?? []) : [];

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="font-semibold">Global user search</h3>
          <p className="text-xs text-muted-foreground">
            Server-side search by name, email, or username.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users…"
            className="ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          {q.trim() && !isLoading && results.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No matches.
            </p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect?.(u.id)}
              className="flex w-full items-center gap-3 rounded-lg border p-2.5 text-start hover:bg-muted/40"
            >
              <Avatar className="h-9 w-9">
                {u.profilePhoto && <AvatarImage src={u.profilePhoto} alt={u.fullName} />}
                <AvatarFallback>{initials(u.firstName, u.lastName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {u.fullName} · <span className="text-muted-foreground">{u.email}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.designation ?? "—"}</p>
              </div>
              <Badge variant={u.isActive ? "default" : "secondary"}>
                {u.isActive ? "Active" : "Inactive"}
              </Badge>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
