import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Users2, Ban, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import {
  useCreateGuestTeam,
  useGuestTeamKpis,
  useGuestTeamOrganizations,
  useGuestTeams,
  useRevokeGuestTeam,
} from "@/hooks/useGuestTeam";
import type { GuestTeamStatus } from "@/types/guest";
import type { AppError } from "@/services/api";

function statusVariant(s: GuestTeamStatus): "default" | "secondary" | "destructive" | "outline" {
  if (s === "active") return "default";
  if (s === "revoked") return "destructive";
  return "outline";
}

const teamSchema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
  name: z.string().trim().min(2, "Required").max(200),
  maxMembers: z.coerce.number().int().min(1).optional().or(z.literal("")),
  sharedDataLimitMb: z.coerce.number().int().min(1).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});
type TeamForm = z.infer<typeof teamSchema>;

export function GuestTeamManagement() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const teams = useGuestTeams();
  const { data: kpis } = useGuestTeamKpis();
  const { data: orgs = [] } = useGuestTeamOrganizations();
  const revoke = useRevokeGuestTeam();

  const filtered = useMemo(() => {
    const rows = teams.data ?? [];
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((t) => t.name.toLowerCase().includes(s) || t.teamCode.toLowerCase().includes(s));
  }, [teams.data, search]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Guest Management"
        title="Guest Teams"
        description="Shared-code groups guests join with a team code — optional pooled data quota and member caps."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New team
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total teams" value={kpis?.total ?? 0} icon={Users2} tone="primary" />
        <StatCard label="Active" value={kpis?.active ?? 0} icon={Users2} tone="success" />
        <StatCard label="Revoked" value={kpis?.revoked ?? 0} icon={Ban} tone="danger" />
        <StatCard label="Total members" value={kpis?.totalMembers ?? 0} icon={Users2} tone="info" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Team code</TableHead>
                  <TableHead>Max members</TableHead>
                  <TableHead>Shared quota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.isLoading && (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {!teams.isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No guest teams yet.</TableCell></TableRow>
                )}
                {filtered.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.organizationName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs">{t.teamCode}</code>
                        <Button
                          size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => { navigator.clipboard.writeText(t.teamCode); toast.success("Copied"); }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t.maxMembers ?? "Unlimited"}</TableCell>
                    <TableCell className="text-sm">{t.sharedDataLimitMb ? `${t.sharedDataLimitMb} MB` : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(t.status)} className="capitalize">{t.status}</Badge></TableCell>
                    <TableCell>
                      {t.status === "active" && (
                        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="icon" variant="ghost" title="Revoke"
                            onClick={async () => {
                              await revoke.mutateAsync({ id: t.id, organizationId: t.organizationId });
                              toast.success("Team revoked");
                            }}
                          >
                            <Ban className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TeamDialog open={creating} orgs={orgs} onClose={() => setCreating(false)} />
    </div>
  );
}

function TeamDialog({
  open, orgs, onClose,
}: {
  open: boolean;
  orgs: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const create = useCreateGuestTeam();
  const form = useForm<TeamForm>({
    resolver: zodResolver(teamSchema),
    defaultValues: { organizationId: "", name: "", maxMembers: "", sharedDataLimitMb: "", expiresAt: "" },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New guest team</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            try {
              await create.mutateAsync({
                organizationId: v.organizationId,
                name: v.name,
                maxMembers: v.maxMembers === "" ? undefined : Number(v.maxMembers),
                sharedDataLimitMb: v.sharedDataLimitMb === "" ? undefined : Number(v.sharedDataLimitMb),
                expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined,
              });
              toast.success("Guest team created");
              form.reset();
              onClose();
            } catch (err) {
              toast.error((err as unknown as AppError).message || "Failed to create team");
            }
          })}
        >
          <div>
            <Label>Organization</Label>
            <Select value={form.watch("organizationId")} onValueChange={(v) => form.setValue("organizationId", v)}>
              <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="name">Team name</Label>
            <Input id="name" {...form.register("name")} />
          </div>
          <div>
            <Label htmlFor="maxMembers">Max members (blank = unlimited)</Label>
            <Input id="maxMembers" type="number" {...form.register("maxMembers")} />
          </div>
          <div>
            <Label htmlFor="sharedDataLimitMb">Shared data quota, MB (blank = none)</Label>
            <Input id="sharedDataLimitMb" type="number" {...form.register("sharedDataLimitMb")} />
          </div>
          <div>
            <Label htmlFor="expiresAt">Expires at (optional)</Label>
            <Input id="expiresAt" type="datetime-local" {...form.register("expiresAt")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
