/**
 * The ISP link and routing-rule create/edit dialogs, moved verbatim from
 * `components/features/OperationsFeatures.tsx` when the Internet Connection
 * page moved into this folder. Behaviour and payloads are unchanged; the
 * only edit is `wy-console` on each DialogContent (Radix portals mount on
 * <body>, outside the page's `.wy-console` wrapper -- see
 * docs/design/console-tokens.md).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  matchFieldLabel,
  matchValueFromRule,
  RULE_TYPES,
} from "@/components/network/IspManagement";
import type {
  IspLink,
  IspLinkRole,
  IspConnectionMode,
  IspRoutingRule,
  IspRoutingRuleType,
} from "@/types/isp";

/* ---------- ISP Details ----------
 * Real per-router WAN uplink model (`app.domains.isp`): an ISP link belongs
 * to a real router, not a fake flat "business unit" list. The customer
 * picks a real router (routerService.listForLocation(), scoped to this
 * location + the session's own org via resolveOrgId() -- routerService's
 * master-console list() fans out across every org via GET /organizations,
 * GLOBAL-scope only, which 403s for an ordinary customer session), then
 * sees/manages that router's real ISP link(s): provider, bandwidth, DNS,
 * priority/role/failover config, and real health-check status written by
 * the isp domain's own 60s Celery sweep (isp_health_checks). All CRUD goes
 * through ispService, which threads X-Organization-Id on every call. */

export const LINK_TYPES: { value: string; label: string }[] = [
  { value: "fiber", label: "Fiber" },
  { value: "dsl", label: "DSL" },
  { value: "cable", label: "Cable" },
  { value: "wireless_4g", label: "4G Wireless" },
  { value: "wireless_5g", label: "5G Wireless" },
  { value: "satellite", label: "Satellite" },
  { value: "leased_line", label: "Leased Line" },
  { value: "other", label: "Other" },
];

// The router's own WAN-facing interface this link terminates on --
// informational only (see backend IspLink.interface's own comment), same
// "not branched on internally" scope as LINK_TYPES above. A select of the
// common MikroTik interface names rather than a free-text box -- an admin
// picking from a short, familiar list beats typing a slug from memory,
// and this field was never validated against the router's real interface
// list anyway (this view never contacts the router to fetch one).
const INTERFACE_OPTIONS: { value: string; label: string }[] = [
  { value: "ether1", label: "ether1" },
  { value: "ether2", label: "ether2" },
  { value: "ether3", label: "ether3" },
  { value: "ether4", label: "ether4" },
  { value: "ether5", label: "ether5" },
  { value: "sfp1", label: "sfp1" },
  { value: "wlan1", label: "wlan1" },
  { value: "lte1", label: "lte1 (4G/5G)" },
  { value: "other", label: "Other" },
];

export interface IspLinkFormState {
  providerName: string;
  linkType: string;
  connectionMode: IspConnectionMode;
  role: IspLinkRole;
  priority: number;
  interfaceName: string;
  gatewayIpAddress: string;
  dnsPrimary: string;
  dnsSecondary: string;
  downloadBandwidthMbps: string;
  uploadBandwidthMbps: string;
  autoFailback: boolean;
}
const emptyLinkForm = (): IspLinkFormState => ({
  providerName: "",
  linkType: "fiber",
  connectionMode: "static",
  role: "primary",
  priority: 0,
  interfaceName: "",
  gatewayIpAddress: "",
  dnsPrimary: "",
  dnsSecondary: "",
  downloadBandwidthMbps: "",
  uploadBandwidthMbps: "",
  autoFailback: true,
});

export function IspLinkDialog({
  open,
  onOpenChange,
  editing,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: IspLink | null;
  saving: boolean;
  onSave: (form: IspLinkFormState) => void;
}) {
  const [form, setForm] = useState<IspLinkFormState>(emptyLinkForm());
  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            providerName: editing.providerName,
            linkType: editing.linkType,
            connectionMode: editing.connectionMode,
            role: editing.role,
            priority: editing.priority,
            interfaceName: editing.interface ?? "",
            gatewayIpAddress: editing.gatewayIpAddress ?? "",
            dnsPrimary: editing.dnsPrimary ?? "",
            dnsSecondary: editing.dnsSecondary ?? "",
            downloadBandwidthMbps:
              editing.downloadBandwidthMbps != null ? String(editing.downloadBandwidthMbps) : "",
            uploadBandwidthMbps:
              editing.uploadBandwidthMbps != null ? String(editing.uploadBandwidthMbps) : "",
            autoFailback: editing.autoFailback,
          }
        : emptyLinkForm(),
    );
  }, [open, editing]);

  const valid = form.providerName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wy-console sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit ISP Link" : "Add ISP Link"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this router's WAN uplink."
              : "Add a new WAN uplink for the selected router."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Internet Provider *</Label>
              <Input
                placeholder="e.g. Airtel"
                value={form.providerName}
                onChange={(e) => setForm({ ...form, providerName: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Link Type</Label>
              <Select
                value={form.linkType}
                onValueChange={(v) => setForm({ ...form, linkType: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as IspLinkRole })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="backup">Backup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Priority</Label>
              <Input
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: +e.target.value || 0 })}
                className="h-9"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Connection Type</Label>
            <Select
              value={form.connectionMode}
              onValueChange={(v) => setForm({ ...form, connectionMode: v as IspConnectionMode })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Static IP</SelectItem>
                <SelectItem value="dhcp">DHCP Client</SelectItem>
                <SelectItem value="pppoe">PPPoE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">
                Interface{form.connectionMode === "pppoe" && " *"}
              </Label>
              <Select
                value={form.interfaceName}
                onValueChange={(v) => setForm({ ...form, interfaceName: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select interface" />
                </SelectTrigger>
                <SelectContent>
                  {INTERFACE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.connectionMode === "pppoe" && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  This interface's own connection state is the health signal for PPPoE.
                </p>
              )}
            </div>
            {form.connectionMode === "static" ? (
              <div>
                <Label className="mb-1 block text-xs">Gateway IP (optional)</Label>
                <Input
                  placeholder="203.0.113.1"
                  value={form.gatewayIpAddress}
                  onChange={(e) => setForm({ ...form, gatewayIpAddress: e.target.value })}
                  className="h-9 font-mono"
                />
              </div>
            ) : (
              <div>
                <Label className="mb-1 block text-xs">Gateway IP</Label>
                <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-[11px] text-muted-foreground">
                  {form.connectionMode === "dhcp"
                    ? "Detected automatically from the router's live DHCP lease"
                    : "Not applicable for PPPoE"}
                </div>
              </div>
            )}
          </div>
          {/* Plan Bandwidth / DNS -- both were already fully wired
              (form state, edit prefill, save payload, and even a table
              column reading them back) but had no actual input in this
              dialog, so there was never a way to set either one (bug
              report: "actual edit ke liye mechanism hai nahi" -- the
              Bandwidth Utilization dashboard card's own "Set it →" link
              landed here and found nothing to fill in). */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Plan Download Speed (Mbps, optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 100"
                value={form.downloadBandwidthMbps}
                onChange={(e) => setForm({ ...form, downloadBandwidthMbps: e.target.value })}
                className="h-9"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Plan Upload Speed (Mbps, optional)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 20"
                value={form.uploadBandwidthMbps}
                onChange={(e) => setForm({ ...form, uploadBandwidthMbps: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Whatever your ISP advertises for this plan — not independently measured, so utilization
            % is only as accurate as this number.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Primary DNS (optional)</Label>
              <Input
                placeholder="1.1.1.1"
                value={form.dnsPrimary}
                onChange={(e) => setForm({ ...form, dnsPrimary: e.target.value })}
                className="h-9 font-mono"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Secondary DNS (optional)</Label>
              <Input
                placeholder="8.8.8.8"
                value={form.dnsSecondary}
                onChange={(e) => setForm({ ...form, dnsSecondary: e.target.value })}
                className="h-9 font-mono"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form)}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface IspRuleFormState {
  ispLinkId: string;
  ruleType: IspRoutingRuleType;
  name: string;
  description: string;
  priority: number;
  matchValue: string;
  isEnabled: boolean;
}
const emptyRuleForm = (defaultLinkId: string): IspRuleFormState => ({
  ispLinkId: defaultLinkId,
  ruleType: "vlan",
  name: "",
  description: "",
  priority: 0,
  matchValue: "",
  isEnabled: true,
});

/** Create/edit dialog for a routing rule, merged in from the former
 * "Internet Failover" page's own rule dialog (IspManagement.tsx's
 * RuleDialog) -- same real ispService.*RoutingRule endpoints, same
 * rule-type vocabulary (RULE_TYPES/matchFieldLabel/matchValueFromRule
 * imported from that file rather than re-derived), just a plain-state
 * form matching this view's own IspLinkDialog above instead of a second
 * react-hook-form+zod stack. */
export function IspRuleDialog({
  open,
  onOpenChange,
  editing,
  links,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: IspRoutingRule | null;
  links: IspLink[];
  saving: boolean;
  onSave: (form: IspRuleFormState) => void;
}) {
  const [form, setForm] = useState<IspRuleFormState>(emptyRuleForm(links[0]?.id ?? ""));
  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            ispLinkId: editing.ispLinkId,
            ruleType: editing.ruleType,
            name: editing.name,
            description: editing.description ?? "",
            priority: editing.priority,
            matchValue: matchValueFromRule(editing),
            isEnabled: editing.isEnabled,
          }
        : emptyRuleForm(links[0]?.id ?? ""),
    );
  }, [open, editing, links]);

  const valid =
    form.name.trim().length > 0 && form.ispLinkId.length > 0 && form.matchValue.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="wy-console sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Routing Rule" : "New Routing Rule"}</DialogTitle>
          <DialogDescription>Pin matching traffic to a specific uplink.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs">Name</Label>
            <Input
              placeholder="VLAN 20 via secondary uplink"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Uplink</Label>
              <Select
                value={form.ispLinkId}
                onValueChange={(v) => setForm({ ...form, ispLinkId: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select uplink" />
                </SelectTrigger>
                <SelectContent>
                  {links.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.providerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Rule Type</Label>
              <Select
                value={form.ruleType}
                onValueChange={(v) =>
                  setForm({ ...form, ruleType: v as IspRoutingRuleType, matchValue: "" })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs">{matchFieldLabel(form.ruleType)}</Label>
            <Input
              className="h-9 font-mono"
              value={form.matchValue}
              onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Priority</Label>
              <Input
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: +e.target.value || 0 })}
                className="h-9"
              />
            </div>
            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
                <div className="text-sm font-medium">Enabled</div>
                <Switch
                  checked={form.isEnabled}
                  onCheckedChange={(v) => setForm({ ...form, isEnabled: v })}
                />
              </div>
            )}
          </div>
          <div>
            <Label className="mb-1 block text-xs">Description (optional)</Label>
            <Input
              placeholder="Notes…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="h-9"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form)}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
