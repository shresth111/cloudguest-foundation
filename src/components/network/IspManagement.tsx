import { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Cable,
  ShieldCheck,
  ShieldOff,
  Activity,
  ArrowLeftRight,
  RotateCcw,
} from "lucide-react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import {
  useIspLinks,
  useCreateIspLink,
  useUpdateIspLink,
  useDeleteIspLink,
  useCheckIspLinkHealth,
  useTriggerIspFailover,
  useTriggerIspFailback,
  useIspRoutingRules,
  useCreateIspRoutingRule,
  useUpdateIspRoutingRule,
  useDeleteIspRoutingRule,
} from "@/hooks/useIsp";
import { routerService } from "@/services/router.service";
import type { AppError } from "@/services/api";
import type { IspLink, IspLinkRole, IspRoutingRule, IspRoutingRuleType } from "@/types/isp";

const PAGE_SIZE = 25;
const ROLES: IspLinkRole[] = ["primary", "backup"];
const RULE_TYPES: IspRoutingRuleType[] = ["vlan", "user", "ip", "source", "interface", "policy"];

function healthTone(status: string): "default" | "destructive" | "secondary" {
  if (status === "healthy") return "default";
  if (status === "unhealthy") return "destructive";
  return "secondary";
}

export function IspManagement() {
  const [routerId, setRouterId] = useState<string>("");
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["isp", "router-options"],
    queryFn: () => routerService.list({ page: 1, pageSize: 100 }),
  });

  const { data: links, isLoading: linksLoading } = useIspLinks({
    page: 1,
    pageSize: PAGE_SIZE,
    routerId: routerId || undefined,
  });
  const { data: rules, isLoading: rulesLoading } = useIspRoutingRules({
    page: 1,
    pageSize: PAGE_SIZE,
    routerId: routerId || undefined,
  });

  const del = useDeleteIspLink();
  const checkHealth = useCheckIspLinkHealth();
  const failover = useTriggerIspFailover();
  const failback = useTriggerIspFailback();
  const delRule = useDeleteIspRoutingRule();

  const [editingLink, setEditingLink] = useState<IspLink | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [confirmDeleteLink, setConfirmDeleteLink] = useState<IspLink | null>(null);

  const [editingRule, setEditingRule] = useState<IspRoutingRule | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<IspRoutingRule | null>(null);

  const rows = links?.rows ?? [];
  const ruleRows = rules?.rows ?? [];
  const healthyCount = rows.filter((l) => l.healthStatus === "healthy").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Network"
        title="ISP Uplinks & Routing"
        description="Per-router uplinks, health checks, manual failover/failback, and policy-based routing rules that pin traffic to a specific link."
        actions={
          <Button onClick={() => setCreatingLink(true)} disabled={!routerId}>
            <Plus className="mr-1.5 h-4 w-4" /> New Uplink
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Uplinks" value={links?.total ?? 0} icon={Cable} tone="primary" />
        <StatCard label="Healthy" value={healthyCount} icon={ShieldCheck} tone="success" />
        <StatCard label="Unhealthy / Unknown" value={rows.length - healthyCount} icon={ShieldOff} tone="warning" />
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">Router</CardTitle>
          <Select value={routerId} onValueChange={setRouterId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a router to manage" />
            </SelectTrigger>
            <SelectContent>
              {routers.rows.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        {routerId && (
          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Button
              size="sm"
              variant="outline"
              disabled={failover.isPending}
              onClick={async () => {
                try {
                  await failover.mutateAsync({ routerId });
                  toast.success("Failover triggered");
                } catch (err) {
                  toast.error((err as AppError).message || "Failover failed");
                }
              }}
            >
              <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Trigger failover
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={failback.isPending}
              onClick={async () => {
                try {
                  await failback.mutateAsync({ routerId });
                  toast.success("Failback triggered");
                } catch (err) {
                  toast.error((err as AppError).message || "Failback failed");
                }
              }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Trigger failback
            </Button>
          </CardContent>
        )}
      </Card>

      {!routerId ? (
        <Card className="border-border/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Select a router above to view its uplinks and routing rules.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Uplinks</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Bandwidth</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linksLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!linksLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No uplinks for this router yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((l) => (
                    <TableRow key={l.id} className="group">
                      <TableCell>
                        <div className="font-medium">{l.providerName}</div>
                        <div className="text-xs text-muted-foreground">{l.linkType}</div>
                      </TableCell>
                      <TableCell className="text-xs uppercase text-muted-foreground">{l.role}</TableCell>
                      <TableCell>
                        <Badge variant={l.isActiveUplink ? "default" : "secondary"}>
                          {l.isActiveUplink ? "Active" : "Standby"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={healthTone(l.healthStatus)} className="capitalize">
                          {l.healthStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.latencyMs != null ? `${l.latencyMs.toFixed(0)} ms` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.downloadBandwidthMbps ?? "—"}↓ / {l.uploadBandwidthMbps ?? "—"}↑ Mbps
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Check health"
                            onClick={async () => {
                              try {
                                await checkHealth.mutateAsync(l.id);
                                toast.success("Health check completed");
                              } catch (err) {
                                toast.error((err as AppError).message || "Health check failed");
                              }
                            }}
                          >
                            <Activity className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingLink(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteLink(l)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Routing rules</CardTitle>
              <Button size="sm" onClick={() => setCreatingRule(true)} disabled={rows.length === 0}>
                <Plus className="mr-1.5 h-4 w-4" /> New Rule
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Uplink</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!rulesLoading && ruleRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No routing rules for this router yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {ruleRows.map((r) => (
                    <TableRow key={r.id} className="group">
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs uppercase text-muted-foreground">{r.ruleType}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.vlanId ?? r.sourceMacAddress ?? r.ipAddress ?? r.sourceCidr ?? r.interfaceName ?? r.policyId ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rows.find((l) => l.id === r.ispLinkId)?.providerName ?? r.ispLinkId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.priority}</TableCell>
                      <TableCell>
                        <Badge variant={r.isEnabled ? "default" : "secondary"}>
                          {r.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button size="icon" variant="ghost" onClick={() => setEditingRule(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteRule(r)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <LinkDialog
        open={creatingLink || !!editingLink}
        link={editingLink}
        routerId={routerId}
        onClose={() => {
          setCreatingLink(false);
          setEditingLink(null);
        }}
      />

      <RuleDialog
        open={creatingRule || !!editingRule}
        rule={editingRule}
        routerId={routerId}
        links={rows}
        onClose={() => {
          setCreatingRule(false);
          setEditingRule(null);
        }}
      />

      <AlertDialog open={!!confirmDeleteLink} onOpenChange={(o) => !o && setConfirmDeleteLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete uplink "{confirmDeleteLink?.providerName}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDeleteLink) return;
                try {
                  await del.mutateAsync(confirmDeleteLink.id);
                  toast.success("Uplink deleted");
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete uplink");
                }
                setConfirmDeleteLink(null);
              }}
            >
              Delete uplink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteRule} onOpenChange={(o) => !o && setConfirmDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rule "{confirmDeleteRule?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDeleteRule) return;
                try {
                  await delRule.mutateAsync(confirmDeleteRule.id);
                  toast.success("Rule deleted");
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete rule");
                }
                setConfirmDeleteRule(null);
              }}
            >
              Delete rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const linkSchema = z.object({
  providerName: z.string().trim().min(1, "Required").max(64),
  linkType: z.string().trim().optional().or(z.literal("")),
  role: z.enum(["primary", "backup"]),
  priority: z.coerce.number().int().min(0),
  interface: z.string().trim().optional().or(z.literal("")),
  gatewayIpAddress: z.string().trim().optional().or(z.literal("")),
  downloadBandwidthMbps: z.coerce.number().int().min(0).optional().or(z.nan()),
  uploadBandwidthMbps: z.coerce.number().int().min(0).optional().or(z.nan()),
  autoFailback: z.boolean(),
  isEnabled: z.boolean(),
});
type LinkFormValues = z.infer<typeof linkSchema>;

function LinkDialog({
  open,
  link,
  routerId,
  onClose,
}: {
  open: boolean;
  link: IspLink | null;
  routerId: string;
  onClose: () => void;
}) {
  const create = useCreateIspLink();
  const update = useUpdateIspLink();

  const defaults: LinkFormValues = link
    ? {
        providerName: link.providerName,
        linkType: link.linkType,
        role: link.role,
        priority: link.priority,
        interface: link.interface ?? "",
        gatewayIpAddress: link.gatewayIpAddress ?? "",
        downloadBandwidthMbps: link.downloadBandwidthMbps ?? Number.NaN,
        uploadBandwidthMbps: link.uploadBandwidthMbps ?? Number.NaN,
        autoFailback: link.autoFailback,
        isEnabled: link.isEnabled,
      }
    : {
        providerName: "",
        linkType: "fiber",
        role: "primary",
        priority: 0,
        interface: "",
        gatewayIpAddress: "",
        downloadBandwidthMbps: Number.NaN,
        uploadBandwidthMbps: Number.NaN,
        autoFailback: true,
        isEnabled: true,
      };

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: defaults,
    values: defaults,
  });

  async function submit(v: LinkFormValues) {
    try {
      const shared = {
        providerName: v.providerName,
        linkType: v.linkType || "other",
        role: v.role,
        priority: v.priority,
        interface: v.interface || null,
        gatewayIpAddress: v.gatewayIpAddress || null,
        downloadBandwidthMbps: Number.isNaN(v.downloadBandwidthMbps) ? null : v.downloadBandwidthMbps,
        uploadBandwidthMbps: Number.isNaN(v.uploadBandwidthMbps) ? null : v.uploadBandwidthMbps,
        autoFailback: v.autoFailback,
      };
      if (link) {
        await update.mutateAsync({ id: link.id, payload: { ...shared, isEnabled: v.isEnabled } });
        toast.success("Uplink updated");
      } else {
        await create.mutateAsync({ routerId, ...shared });
        toast.success("Uplink created");
      }
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save uplink");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{link ? "Edit uplink" : "New uplink"}</DialogTitle>
          <DialogDescription>An ISP uplink belongs to exactly one router.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Provider name</Label>
            <Input {...form.register("providerName")} placeholder="Airtel Business" />
            {form.formState.errors.providerName && (
              <p className="text-[11px] text-destructive">{form.formState.errors.providerName.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Link type</Label>
            <Input {...form.register("linkType")} placeholder="fiber" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Role</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority</Label>
            <Input type="number" min={0} {...form.register("priority")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Interface (optional)</Label>
            <Input {...form.register("interface")} placeholder="ether2" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Gateway IP (optional)</Label>
            <Input {...form.register("gatewayIpAddress")} placeholder="203.0.113.1" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Download (Mbps, optional)</Label>
            <Input type="number" min={0} {...form.register("downloadBandwidthMbps")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Upload (Mbps, optional)</Label>
            <Input type="number" min={0} {...form.register("uploadBandwidthMbps")} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
            <div className="text-sm font-medium">Auto failback</div>
            <Controller
              control={form.control}
              name="autoFailback"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          {link && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
              <div className="text-sm font-medium">Enabled</div>
              <Controller
                control={form.control}
                name="isEnabled"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
              />
            </div>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {link ? "Save changes" : "Create uplink"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ruleSchema = z.object({
  ispLinkId: z.string().min(1, "Select an uplink"),
  ruleType: z.enum(["vlan", "user", "ip", "source", "interface", "policy"]),
  name: z.string().trim().min(1, "Required").max(64),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0),
  matchValue: z.string().trim().min(1, "Required"),
  isEnabled: z.boolean(),
});
type RuleFormValues = z.infer<typeof ruleSchema>;

function matchFieldLabel(t: IspRoutingRuleType): string {
  switch (t) {
    case "vlan": return "VLAN ID";
    case "user": return "Source MAC address";
    case "ip": return "IP address";
    case "source": return "Source CIDR";
    case "interface": return "Interface name";
    case "policy": return "Policy ID";
  }
}

function matchValueFromRule(r: IspRoutingRule): string {
  return String(r.vlanId ?? r.sourceMacAddress ?? r.ipAddress ?? r.sourceCidr ?? r.interfaceName ?? r.policyId ?? "");
}

function RuleDialog({
  open,
  rule,
  routerId,
  links,
  onClose,
}: {
  open: boolean;
  rule: IspRoutingRule | null;
  routerId: string;
  links: IspLink[];
  onClose: () => void;
}) {
  const create = useCreateIspRoutingRule();
  const update = useUpdateIspRoutingRule();

  const defaults: RuleFormValues = rule
    ? {
        ispLinkId: rule.ispLinkId,
        ruleType: rule.ruleType,
        name: rule.name,
        description: rule.description ?? "",
        priority: rule.priority,
        matchValue: matchValueFromRule(rule),
        isEnabled: rule.isEnabled,
      }
    : {
        ispLinkId: links[0]?.id ?? "",
        ruleType: "vlan",
        name: "",
        description: "",
        priority: 0,
        matchValue: "",
        isEnabled: true,
      };

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: defaults,
    values: defaults,
  });
  const ruleType = form.watch("ruleType");

  async function submit(v: RuleFormValues) {
    try {
      const matchFields = {
        vlanId: v.ruleType === "vlan" ? Number(v.matchValue) : null,
        sourceMacAddress: v.ruleType === "user" ? v.matchValue : null,
        ipAddress: v.ruleType === "ip" ? v.matchValue : null,
        sourceCidr: v.ruleType === "source" ? v.matchValue : null,
        interfaceName: v.ruleType === "interface" ? v.matchValue : null,
        policyId: v.ruleType === "policy" ? v.matchValue : null,
      };
      const shared = {
        ispLinkId: v.ispLinkId,
        ruleType: v.ruleType,
        name: v.name,
        description: v.description || null,
        priority: v.priority,
        ...matchFields,
      };
      if (rule) {
        await update.mutateAsync({ id: rule.id, payload: { ...shared, isEnabled: v.isEnabled } });
        toast.success("Routing rule updated");
      } else {
        await create.mutateAsync({ routerId, ...shared });
        toast.success("Routing rule created");
      }
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save rule");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit routing rule" : "New routing rule"}</DialogTitle>
          <DialogDescription>Pin matching traffic to a specific uplink.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input {...form.register("name")} placeholder="VLAN 20 via secondary uplink" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Uplink</Label>
            <Controller
              control={form.control}
              name="ispLinkId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select uplink" /></SelectTrigger>
                  <SelectContent>
                    {links.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.providerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.ispLinkId && (
              <p className="text-[11px] text-destructive">{form.formState.errors.ispLinkId.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Rule type</Label>
            <Controller
              control={form.control}
              name="ruleType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">{matchFieldLabel(ruleType)}</Label>
            <Input {...form.register("matchValue")} className="font-mono" />
            {form.formState.errors.matchValue && (
              <p className="text-[11px] text-destructive">{form.formState.errors.matchValue.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority</Label>
            <Input type="number" min={0} {...form.register("priority")} />
          </div>
          {rule && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
              <div className="text-sm font-medium">Enabled</div>
              <Controller
                control={form.control}
                name="isEnabled"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
              />
            </div>
          )}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Description (optional)</Label>
            <Input {...form.register("description")} placeholder="Notes…" />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {rule ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
