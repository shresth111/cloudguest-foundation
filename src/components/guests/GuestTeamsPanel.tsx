import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Ban, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { guestTeamSchema, type GuestTeamFormValues } from "@/lib/guest-schemas";
import {
  useCreateGuestTeam,
  useGuestTeam,
  useGuestTeams,
  useRevokeGuestTeam,
} from "@/hooks/useGuests";
import { guestService } from "@/services/guest.service";
import type { AppError } from "@/services/api";
import type { GuestTeam } from "@/types/guest";
import { GUEST_TEAM_STATUS_LABEL } from "@/types/guest";

const DEFAULTS: GuestTeamFormValues = {
  organizationId: "",
  locationId: "",
  name: "",
  maxMembers: "",
  sharedDataLimitMb: "",
  expiresAt: "",
};

const STATUS_STYLES: Record<GuestTeam["status"], string> = {
  active: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  expired: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  revoked: "border-rose-500/30 text-rose-600 dark:text-rose-400",
};

export function GuestTeamsPanel() {
  const { data, isLoading } = useGuestTeams();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Guest teams</h3>
          <p className="text-sm text-muted-foreground">
            A cohort for bulk operations — a corporate delegation, a wedding party, a conference
            cohort.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="ml-2">Create team</span>
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No guest teams"
          description="Create a team to group guests for bulk operations."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id} className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-tight">{t.name}</CardTitle>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{t.teamCode}</p>
                  </div>
                  <Badge variant="outline" className={STATUS_STYLES[t.status]}>
                    {GUEST_TEAM_STATUS_LABEL[t.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {t.maxMembers ? `Up to ${t.maxMembers} members` : "Unlimited members"}
                  {t.sharedDataLimitMb ? ` · ${t.sharedDataLimitMb} MB shared quota` : ""}
                </div>
                {t.expiresAt && (
                  <div className="text-xs text-muted-foreground">
                    Expires {new Date(t.expiresAt).toLocaleString()}
                  </div>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedTeamId(t.id)}>
                  View roster
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TeamDetailDialog
        teamId={selectedTeamId}
        onOpenChange={(o) => !o && setSelectedTeamId(null)}
      />
    </div>
  );
}

function CreateTeamDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateGuestTeam();
  const { data: organizations = [] } = useQuery({
    queryKey: ["guests", "org-options"],
    queryFn: () => guestService.organizations(),
    enabled: open,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["guests", "location-options"],
    queryFn: () => guestService.locations(),
    enabled: open,
  });

  const form = useForm<GuestTeamFormValues>({
    resolver: zodResolver(guestTeamSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });
  const organizationId = form.watch("organizationId");
  const locationOptions = useMemo(
    () => locations.filter((l) => l.organizationId === organizationId),
    [locations, organizationId],
  );

  async function submit(values: GuestTeamFormValues) {
    try {
      await create.mutateAsync({
        organizationId: values.organizationId,
        locationId: values.locationId || undefined,
        name: values.name,
        maxMembers: values.maxMembers ? Number(values.maxMembers) : undefined,
        sharedDataLimitMb: values.sharedDataLimitMb ? Number(values.sharedDataLimitMb) : undefined,
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      });
      toast.success("Team created");
      onOpenChange(false);
      form.reset(DEFAULTS);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to create team");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) form.reset(DEFAULTS);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create guest team</DialogTitle>
          <DialogDescription>
            Guests join with a shareable code; the roster can be revoked as a unit.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp offsite" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (optional)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Org-wide" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locationOptions.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="maxMembers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max members (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Unlimited" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sharedDataLimitMb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shared data limit MB (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="No pooling" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expires at (optional)</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TeamDetailDialog({
  teamId,
  onOpenChange,
}: {
  teamId: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useGuestTeam(teamId ?? "");
  const revoke = useRevokeGuestTeam();
  const [confirm, setConfirm] = useState(false);

  return (
    <Dialog open={!!teamId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{data?.team.name ?? "Team"}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{data?.team.teamCode}</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Members" value={data.summary.memberCount} />
              <Stat label="Active sessions" value={data.summary.activeSessionCount} />
              <Stat
                label="Total bandwidth"
                value={`${(data.summary.totalBandwidthBytes / 1024 ** 2).toFixed(1)} MB`}
              />
              <Stat
                label="Remaining quota"
                value={
                  data.summary.remainingSharedQuotaMb != null
                    ? `${data.summary.remainingSharedQuotaMb} MB`
                    : "No pooling"
                }
              />
            </div>
            {data.summary.quotaExceeded && (
              <p className="text-xs text-rose-600">Shared data quota has been exceeded.</p>
            )}
            {data.team.status === "active" && (
              <Button variant="destructive" size="sm" onClick={() => setConfirm(true)}>
                <Ban className="h-4 w-4" />
                <span className="ml-2">Revoke team</span>
              </Button>
            )}
          </div>
        )}
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Revoke this team?"
          description="Every active member's active sessions will be terminated. This cannot be undone."
          destructive
          onConfirm={async () => {
            if (!teamId) return;
            try {
              const result = await revoke.mutateAsync(teamId);
              toast.success(
                result.failedMemberIds.length
                  ? `Team revoked (${result.failedMemberIds.length} member(s) failed to terminate)`
                  : "Team revoked",
              );
            } catch (err) {
              toast.error((err as AppError).message || "Failed to revoke team");
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
