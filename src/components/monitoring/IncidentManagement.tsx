import { useState } from "react";
import { toast } from "sonner";
import { MessageSquarePlus, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PriorityBadge, IncidentStatusBadge } from "./MonitoringBadges";
import {
  useAddIncidentNote,
  useIncidents,
  useUpdateIncident,
} from "@/hooks/useMonitoring";
import type { Incident } from "@/types/monitoring";

const ENGINEERS = ["Priya Shah", "Marco Rossi", "Ada Chen", "Kenji Tanaka", "Lucas Silva"];

export function IncidentManagement() {
  const { data, isLoading, isError, refetch } = useIncidents();
  const update = useUpdateIncident();
  const addNote = useAddIncidentNote();

  const [selected, setSelected] = useState<Incident | null>(null);
  const [note, setNote] = useState("");

  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;
  if (data.length === 0) return <EmptyState title="No incidents" description="No incidents opened in the last 48 hours." />;

  const setStatus = (id: string, status: Incident["status"]) => {
    const patch: Partial<Incident> = { status };
    if (status === "resolved") patch.resolvedAt = new Date().toISOString();
    if (status === "open") patch.resolvedAt = undefined;
    update.mutate({ id, patch }, { onSuccess: () => toast.success(`Incident ${status}`) });
  };

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.map((i) => (
          <Card key={i.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{i.id}</span>
                <span className="flex-1">{i.title}</span>
                <PriorityBadge priority={i.priority} />
                <IncidentStatusBadge status={i.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{i.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">Assigned:</span> {i.assignedTo ?? "Unassigned"}</div>
                <div><span className="font-medium text-foreground">Created:</span> {new Date(i.createdAt).toLocaleString()}</div>
                <div className="col-span-2"><span className="font-medium text-foreground">Resolved:</span> {i.resolvedAt ? new Date(i.resolvedAt).toLocaleString() : "—"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={i.assignedTo ?? "unassigned"} onValueChange={(v) => update.mutate({ id: i.id, patch: { assignedTo: v === "unassigned" ? undefined : v } }, { onSuccess: () => toast.success("Assignment updated") })}>
                  <SelectTrigger className="h-8 w-44 text-xs"><UserCog className="mr-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {ENGINEERS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                {i.status !== "resolved" && i.status !== "closed" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(i.id, "resolved")}>Resolve</Button>
                )}
                {(i.status === "resolved" || i.status === "closed") && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(i.id, "open")}>Reopen</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setSelected(i); setNote(""); }}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" /> Notes ({i.notes.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.id} · {selected?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {selected?.notes.map((n) => (
              <div key={n.id} className="rounded-md border bg-muted/40 p-2 text-sm">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{n.author}</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                {n.message}
              </div>
            ))}
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an update…" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Button
              disabled={!note.trim()}
              onClick={() => {
                if (!selected) return;
                addNote.mutate(
                  { id: selected.id, author: "You", message: note.trim() },
                  {
                    onSuccess: (updated) => {
                      toast.success("Note added");
                      setSelected(updated);
                      setNote("");
                    },
                  },
                );
              }}
            >Add note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
