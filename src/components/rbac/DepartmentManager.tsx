import { useState } from "react";
import { toast } from "sonner";
import { Building, Plus, Trash2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRbacDepartments } from "@/hooks/useRbac";
import { Skeleton } from "@/components/ui/skeleton";

export function DepartmentManager() {
  const { data, isLoading } = useRbacDepartments();
  const [local, setLocal] = useState<{ id: string; name: string; members: number }[]>([]);
  const [newName, setNewName] = useState("");
  const items = local.length ? local : (data ?? []);

  const add = () => {
    if (!newName.trim()) return;
    setLocal([{ id: `dep-${Date.now()}`, name: newName.trim(), members: 0 }, ...items]);
    setNewName(""); toast.success("Department added");
  };
  const remove = (id: string) => { setLocal(items.filter((d) => d.id !== id)); toast.success("Department removed"); };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Departments</h3>
          <p className="text-xs text-muted-foreground">Organize users by functional area.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="New department name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add}><Plus className="me-1.5 h-4 w-4" /> Add</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />) : items.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Building className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{d.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> {d.members} members</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(d.id)} aria-label="Remove department"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["IT", "Network", "Operations", "Marketing", "Finance", "Reception", "Management", "Support"].map((s) => (
            <Badge key={s} variant="outline">{s}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
