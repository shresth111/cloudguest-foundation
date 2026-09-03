import { useState } from "react";
import { Plus, Search, Trash2, Pencil, Ban, ShieldCheck, Globe2 } from "lucide-react";
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
  useContentFilterRules,
  useCreateContentFilterRule,
  useUpdateContentFilterRule,
  useDeleteContentFilterRule,
} from "@/hooks/useContentFilter";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import type { AppError } from "@/services/api";
import {
  CONTENT_FILTER_CATEGORY_LABELS,
  type ContentFilterCategory,
  type ContentFilterRule,
  type ContentFilterValueType,
} from "@/types/contentFilter";

const PAGE_SIZE = 25;
const VALUE_TYPES = ["domain", "ip_cidr"] as const;
const CATEGORIES = [
  "social_media",
  "adult_content",
  "gambling",
  "streaming",
  "gaming",
  "custom",
] as const satisfies readonly ContentFilterCategory[];

// Mirrors app.domains.content_filtering.validators: a domain rule is a
// bare hostname (no scheme/path -- this blocks the whole site via DNS,
// not one URL), an ip_cidr rule is a real IP or CIDR block.
const ruleSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  name: z.string().trim().min(2, "Required").max(48),
  valueType: z.enum(VALUE_TYPES),
  value: z
    .string()
    .trim()
    .min(1, "Required")
    .max(255)
    .refine(
      (v) => !v.includes("://") && !v.includes("/"),
      "Enter a bare domain (e.g. facebook.com) or IP/CIDR — no https:// or path",
    ),
  category: z.enum(CATEGORIES).optional(),
  comment: z.string().trim().max(255).optional(),
  isEnabled: z.boolean(),
});
type RuleFormValues = z.infer<typeof ruleSchema>;

function valueTypeLabel(t: ContentFilterValueType): string {
  return t === "domain" ? "Domain" : "IP / CIDR";
}

// Was nothing -- Call Priority/DHCP/VLAN/Port Forwarding/ISP Routing all
// had a real backend domain with no gap; content filtering (per-router
// website/IP blocking) had neither a frontend component nor, until this
// session, a backend domain to reuse. Follows QosManagement's own
// structure/conventions (orgHeaders/scopedOrgId pattern, location-scoped
// client-side pagination over one full page -- the backend's own
// GET /content-filter-rules only filters by router_id, not location,
// same tradeoff every sibling network page here already makes).
export function ContentFilterManagement({ locationId }: { locationId?: string } = {}) {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ContentFilterRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ContentFilterRule | null>(null);

  // useIsDemo(), not isDemo() directly -- see QosManagement's identical
  // comment: isDemo() resolves differently between the server render pass
  // and the client's first hydration pass, which throws a real "Hydration
  // failed" on this page's loading/empty-state text otherwise.
  const demoFlag = useIsDemo();

  const { data: scopedOrgId } = useQuery({
    queryKey: ["content-filter", "org-id"],
    queryFn: resolveOrgId,
    enabled: !!locationId && !demoFlag,
  });

  const { data, isLoading } = useContentFilterRules(
    {
      page: locationId ? 1 : page,
      pageSize: locationId ? 100 : PAGE_SIZE,
      routerId: routerFilter === "all" ? undefined : routerFilter,
      organizationId: locationId ? scopedOrgId : undefined,
    },
    { enabled: locationId ? demoFlag || !!scopedOrgId : true },
  );
  const del = useDeleteContentFilterRule();
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["content-filter", "router-options", locationId],
    queryFn: async () => {
      if (locationId) {
        const orgId = isDemo() ? "" : await resolveOrgId();
        const rows = await routerService.listForLocation(locationId, orgId);
        return { rows, total: rows.length };
      }
      return routerService.list({ page: 1, pageSize: 100 });
    },
  });

  const routerName = (id: string) => routers.rows.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const filteredRows = (data?.rows ?? []).filter((r) => {
    if (locationId && r.locationId !== locationId) return false;
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(t) ||
      r.value.toLowerCase().includes(t) ||
      routerName(r.routerId).toLowerCase().includes(t)
    );
  });

  const rows = locationId
    ? filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filteredRows;
  const total = locationId ? filteredRows.length : (data?.total ?? 0);
  const totalPages = locationId
    ? Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
    : (data?.totalPages ?? 1);
  const hasNext = locationId ? page < totalPages : !!data?.hasNext;
  const hasPrevious = locationId ? page > 1 : !!data?.hasPrevious;
  const enabledCount = filteredRows.filter((r) => r.isEnabled).length;
  const domainCount = filteredRows.filter((r) => r.valueType === "domain").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Ban}
        eyebrow="Network"
        title="Website Blocking"
        description="Block specific websites or IP ranges on guest WiFi -- a blocked domain simply fails to resolve; an IP/CIDR is dropped at the firewall. Applies the next time this router's configuration is pushed."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Block a website
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Rules" value={total} icon={Ban} tone="primary" />
        <StatCard label="Enabled" value={enabledCount} icon={ShieldCheck} tone="success" />
        <StatCard label="Blocked domains" value={domainCount} icon={Globe2} tone="info" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All Rules</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={routerFilter}
              onValueChange={(v) => {
                setRouterFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All routers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routers</SelectItem>
                {routers.rows.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, website, router…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>Blocked</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No blocking rules match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell className="min-w-0 truncate font-medium">{r.name}</TableCell>
                  <TableCell className="text-sm">{routerName(r.routerId)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="text-muted-foreground">{valueTypeLabel(r.valueType)}:</span>{" "}
                    {r.value}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.category ? (
                      <Badge variant="outline">{CONTENT_FILTER_CATEGORY_LABELS[r.category]}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.isEnabled ? "default" : "secondary"}>
                      {r.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {total} rules
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasPrevious}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RuleDialog
        open={creating || !!editing}
        rule={editing}
        routers={routers.rows}
        organizationId={locationId ? scopedOrgId : undefined}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove block on "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this rule from{" "}
              {confirmDelete ? routerName(confirmDelete.routerId) : ""}. The site/IP will resolve
              normally again once this router's configuration is next pushed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync({
                    id: confirmDelete.id,
                    organizationId: locationId ? scopedOrgId : undefined,
                  });
                  toast.success(`"${confirmDelete.name}" unblocked`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete rule");
                }
                setConfirmDelete(null);
              }}
            >
              Remove block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleDialog({
  open,
  rule,
  routers,
  organizationId,
  onClose,
}: {
  open: boolean;
  rule: ContentFilterRule | null;
  routers: { id: string; name: string }[];
  organizationId?: string;
  onClose: () => void;
}) {
  const create = useCreateContentFilterRule();
  const update = useUpdateContentFilterRule();

  const blank: RuleFormValues = {
    routerId: "",
    name: "",
    valueType: "domain",
    value: "",
    category: undefined,
    comment: undefined,
    isEnabled: true,
  };
  const defaults: RuleFormValues = rule
    ? {
        routerId: rule.routerId,
        name: rule.name,
        valueType: rule.valueType,
        value: rule.value,
        category: rule.category ?? undefined,
        comment: rule.comment ?? undefined,
        isEnabled: rule.isEnabled,
      }
    : blank;

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: defaults,
    values: defaults,
  });
  const valueType = form.watch("valueType");

  /** Resets the form on the way out, so the next open starts clean.
   *
   * `useForm`'s `values` prop only resyncs when the object it is handed
   * deep-changes, and this dialog is never unmounted -- two consecutive
   * opens of the same target hand it the identical blank defaults, so no
   * reset fires and React Hook Form repopulates every input from the form
   * state it kept as each field re-registers. The dialog then reopens
   * showing the last attempt's values. Same convention as NasDevicesPanel
   * and SlaPanel. */
  function close() {
    form.reset(blank);
    onClose();
  }

  async function submit(v: RuleFormValues) {
    const payload = {
      name: v.name,
      valueType: v.valueType,
      value: v.value,
      category: v.category ?? null,
      comment: v.comment ?? null,
      isEnabled: v.isEnabled,
    };
    try {
      if (rule) {
        await update.mutateAsync({ id: rule.id, payload, organizationId });
        toast.success("Rule updated");
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...payload, organizationId });
        toast.success(`"${v.name}" blocked`);
      }
      close();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save rule");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "Block a website"}</DialogTitle>
          <DialogDescription>
            {rule
              ? "The router this rule belongs to cannot be changed — delete and recreate to move it."
              : "Block a domain (and every subdomain) or an IP/CIDR range for this router's guest network."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Router</Label>
            <Controller
              control={form.control}
              name="routerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!rule}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select router" />
                  </SelectTrigger>
                  <SelectContent>
                    {routers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.routerId && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.routerId.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input {...form.register("name")} placeholder="Block Facebook" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type</Label>
            <Controller
              control={form.control}
              name="valueType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="ip_cidr">IP / CIDR</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category (optional)</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value ?? "__none"}
                  onValueChange={(v) => field.onChange(v === "__none" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONTENT_FILTER_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">
              {valueType === "domain" ? "Domain" : "IP address or CIDR"}
            </Label>
            <Input
              {...form.register("value")}
              placeholder={valueType === "domain" ? "facebook.com" : "203.0.113.0/24"}
            />
            {form.formState.errors.value && (
              <p className="text-[11px] text-destructive">{form.formState.errors.value.message}</p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-xs font-medium">Enabled</Label>
            <Controller
              control={form.control}
              name="isEnabled"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {rule ? "Save changes" : "Block website"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
