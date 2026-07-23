import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Search, Trash2, Pencil, Megaphone, Activity, CalendarClock, FileEdit,
  Play, Pause, RotateCcw, Square, Copy,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import {
  useCampaigns, useCampaignKpis, useCreateCampaign, useUpdateCampaign, useDeleteCampaign,
  useCloneCampaign, useScheduleCampaign, usePauseCampaign, useResumeCampaign, useEndCampaign,
} from "@/hooks/useCampaign";
import { useAllLocations } from "@/hooks/useLocations";
import { campaignService } from "@/services/campaign.service";
import type { Campaign, CampaignStatus, CampaignType, DisplayRule } from "@/types/campaign";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  campaignType: z.enum(["survey", "banner", "redirect"]),
  locationId: z.string().optional(),
  displayRule: z.enum(["every_login", "first_login_only", "once_per_n_days"]),
  displayIntervalDays: z.coerce.number().int().min(1).max(365).optional(),
  targetNetworks: z.string().optional(),
  isSkippable: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const STATUS_TONE: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  scheduled: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-transparent",
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent",
  ended: "bg-red-500/10 text-red-600 dark:text-red-400 border-transparent",
};

export function CampaignManagement() {
  const { data: orgId } = useQuery({
    queryKey: ["campaign", "org"],
    queryFn: () => campaignService.getOrganizationId(),
  });
  const { data: allLocations = [] } = useAllLocations();
  const locations = useMemo(
    () => allLocations.filter((l) => l.organizationId === orgId),
    [allLocations, orgId],
  );

  const { data, isLoading } = useCampaigns({ page: 1, pageSize: 100 });
  const { data: kpis } = useCampaignKpis();
  const create = useCreateCampaign();
  const update = useUpdateCampaign();
  const del = useDeleteCampaign();
  const clone = useCloneCampaign();
  const schedule = useScheduleCampaign();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const end = useEndCampaign();

  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter((c) => c.name.toLowerCase().includes(t));
  }, [rows, q]);

  const locationName = (id: string | null) =>
    id ? locations.find((l) => l.id === id)?.name ?? "—" : "Org-wide";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Guest Management"
        title="Campaigns"
        description="Portal surveys, banners and redirects shown to guests at login."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Campaign
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={kpis?.total ?? 0} icon={Megaphone} tone="primary" />
        <StatCard label="Active" value={kpis?.active ?? 0} icon={Activity} tone="success" />
        <StatCard label="Scheduled" value={kpis?.scheduled ?? 0} icon={CalendarClock} tone="info" />
        <StatCard label="Drafts" value={kpis?.draft ?? 0} icon={FileEdit} tone="warning" />
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm transition-all duration-200 hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All campaigns</CardTitle>
          <div className="relative w-72 max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-8" />
          </div>
        </CardHeader>
        <CardContent className={cn(!isLoading && filtered.length === 0 ? "p-6" : "overflow-x-auto p-0")}>
          {!isLoading && filtered.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Create your first campaign to show surveys, banners or redirects to guests at login."
              action={{ label: "New campaign", onClick: () => setCreating(true) }}
            />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Display rule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full max-w-32" /></TableCell>
                  ))}
                </TableRow>
              ))}
              {filtered.map((c) => (
                <TableRow key={c.id} className="group">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.campaignType}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{locationName(c.locationId)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.displayRule.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", STATUS_TONE[c.status])}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {c.status === "draft" && (
                        <Button size="icon" variant="ghost" title="Schedule"
                          onClick={async () => { await schedule.mutateAsync(c.id); toast.success("Campaign scheduled"); }}>
                          <CalendarClock className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(c.status === "scheduled" || c.status === "active") && (
                        <Button size="icon" variant="ghost" title="Pause"
                          onClick={async () => { await pause.mutateAsync(c.id); toast.success("Campaign paused"); }}>
                          <Pause className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {c.status === "paused" && (
                        <Button size="icon" variant="ghost" title="Resume"
                          onClick={async () => { await resume.mutateAsync(c.id); toast.success("Campaign resumed"); }}>
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {c.status !== "ended" && c.status !== "draft" && (
                        <Button size="icon" variant="ghost" title="End"
                          onClick={async () => { await end.mutateAsync(c.id); toast.success("Campaign ended"); }}>
                          <Square className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" title="Clone"
                        onClick={async () => { await clone.mutateAsync({ id: c.id, newName: `${c.name} (copy)` }); toast.success("Campaign cloned"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditing(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Delete"
                        onClick={async () => { await del.mutateAsync(c.id); toast.success("Campaign deleted"); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <CampaignDialog
        open={creating || !!editing}
        campaign={editing}
        locations={locations}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={async (v) => {
          const targetNetworks = (v.targetNetworks ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          if (editing) {
            await update.mutateAsync({
              id: editing.id,
              payload: {
                locationId: v.locationId || null,
                name: v.name,
                displayRule: v.displayRule,
                displayIntervalDays: v.displayIntervalDays,
                targetNetworks,
                isSkippable: v.isSkippable,
              },
            });
            toast.success("Campaign updated");
          } else {
            await create.mutateAsync({
              locationId: v.locationId || null,
              name: v.name,
              campaignType: v.campaignType,
              displayRule: v.displayRule,
              displayIntervalDays: v.displayIntervalDays,
              targetNetworks,
              isSkippable: v.isSkippable,
            });
            toast.success("Campaign created");
          }
          setCreating(false); setEditing(null);
        }}
      />
    </div>
  );
}

function CampaignDialog({
  open, campaign, locations, onClose, onSave,
}: {
  open: boolean;
  campaign: Campaign | null;
  locations: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (v: FormValues) => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: campaign
      ? {
          name: campaign.name,
          campaignType: campaign.campaignType,
          locationId: campaign.locationId ?? undefined,
          displayRule: campaign.displayRule,
          displayIntervalDays: campaign.displayIntervalDays ?? undefined,
          targetNetworks: campaign.targetNetworks.join(", "),
          isSkippable: campaign.isSkippable,
        }
      : {
          name: "", campaignType: "survey" as CampaignType, locationId: undefined,
          displayRule: "every_login" as DisplayRule, displayIntervalDays: undefined,
          targetNetworks: "", isSkippable: true,
        },
  });
  const values = form.watch();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); form.reset(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit campaign" : "New campaign"}</DialogTitle>
          <DialogDescription>
            Shown to guests on the captive portal per the display rule below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(async (v) => { await onSave(v); form.reset(); })} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="Type">
              <Select
                value={values.campaignType}
                onValueChange={(v) => form.setValue("campaignType", v as CampaignType)}
                disabled={!!campaign}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="survey">Survey</SelectItem>
                  <SelectItem value="banner">Banner</SelectItem>
                  <SelectItem value="redirect">Redirect</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location" hint="Leave unset for an org-wide campaign">
              <Select
                value={values.locationId ?? "__org__"}
                onValueChange={(v) => form.setValue("locationId", v === "__org__" ? undefined : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__org__">Org-wide</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Display rule">
              <Select value={values.displayRule} onValueChange={(v) => form.setValue("displayRule", v as DisplayRule)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="every_login">Every login</SelectItem>
                  <SelectItem value="first_login_only">First login only</SelectItem>
                  <SelectItem value="once_per_n_days">Once per N days</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {values.displayRule === "once_per_n_days" && (
              <Field label="Repeat every (days)">
                <Input type="number" {...form.register("displayIntervalDays")} />
              </Field>
            )}
            <Field label="Target networks / SSIDs" className="sm:col-span-2" hint="Comma-separated, leave blank for all">
              <Input {...form.register("targetNetworks")} placeholder="Guest-WiFi, Lobby-5G" />
            </Field>
            <SwitchField label="Skippable" checked={values.isSkippable}
              onChange={(b) => form.setValue("isSkippable", b)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">{campaign ? "Save changes" : "Create campaign"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
      <div className="text-sm font-medium">{label}</div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
