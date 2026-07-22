import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Plus, ShieldQuestion, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  accessCheckSchema,
  accessRuleSchema,
  type AccessCheckFormValues,
  type AccessRuleFormValues,
} from "@/lib/guest-schemas";
import {
  useAccessRules,
  useCheckAccess,
  useCreateAccessRule,
  useDeactivateAccessRule,
  useDeleteAccessRule,
} from "@/hooks/useGuests";
import { guestService } from "@/services/guest.service";
import type { AppError } from "@/services/api";
import { AccessRuleTypeBadge } from "./GuestBadges";

const DEFAULTS: AccessRuleFormValues = {
  kind: "identifier",
  organizationId: "",
  locationId: "",
  identifier: "",
  macAddress: "",
  ruleType: "blocklist",
  reason: "",
  expiresAt: "",
};

export function AccessRulesPanel() {
  const { data, isLoading, refetch } = useAccessRules();
  const deactivate = useDeactivateAccessRule();
  const remove = useDeleteAccessRule();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>(null);

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Access rules</h3>
          <p className="text-sm text-muted-foreground">
            VIP &gt; Temporary &gt; Blocklist &gt; Whitelist — default-allow if nothing matches.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="ml-2">Add rule</span>
        </Button>
      </div>

      <CheckAccessTool />

      <Card className="overflow-hidden rounded-2xl border-border/70">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldQuestion}
            title="No access rules"
            description="Add a VIP, temporary, blocklist or whitelist rule keyed by identifier or MAC address."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Keyed by</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.kind}-${r.id}`} className="hover:bg-muted/30">
                    <TableCell className="text-xs uppercase text-muted-foreground">
                      {r.kind}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.kind === "identifier" ? r.identifier : r.macAddress}
                    </TableCell>
                    <TableCell>
                      <AccessRuleTypeBadge type={r.ruleType} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.expiresAt ? new Date(r.expiresAt).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-xs">{r.isActive ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Deactivate"
                            onClick={() =>
                              setConfirm({
                                title: "Deactivate rule?",
                                description: "The rule stops being enforced but stays in the list.",
                                onConfirm: async () => {
                                  try {
                                    await deactivate.mutateAsync({ kind: r.kind, ruleId: r.id });
                                    toast.success("Rule deactivated");
                                  } catch (err) {
                                    toast.error(
                                      (err as AppError).message || "Failed to deactivate",
                                    );
                                  }
                                },
                              })
                            }
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Delete"
                          onClick={() =>
                            setConfirm({
                              title: "Delete rule?",
                              description: "This permanently removes the rule.",
                              destructive: true,
                              onConfirm: async () => {
                                try {
                                  await remove.mutateAsync({ kind: r.kind, ruleId: r.id });
                                  toast.success("Rule deleted");
                                } catch (err) {
                                  toast.error((err as AppError).message || "Failed to delete");
                                }
                              },
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <CreateAccessRuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => refetch()}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        destructive={confirm?.destructive}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </div>
  );
}

function CreateAccessRuleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const create = useCreateAccessRule();
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

  const form = useForm<AccessRuleFormValues>({
    resolver: zodResolver(accessRuleSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  const kind = form.watch("kind");
  const ruleType = form.watch("ruleType");
  const organizationId = form.watch("organizationId");
  const locationOptions = useMemo(
    () => locations.filter((l) => l.organizationId === organizationId),
    [locations, organizationId],
  );

  async function submit(values: AccessRuleFormValues) {
    try {
      await create.mutateAsync({
        kind: values.kind,
        organizationId: values.organizationId,
        locationId: values.locationId || undefined,
        identifier: values.kind === "identifier" ? values.identifier : undefined,
        macAddress: values.kind === "device" ? values.macAddress : undefined,
        ruleType: values.ruleType,
        reason: values.reason || undefined,
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      });
      toast.success("Access rule created");
      onOpenChange(false);
      form.reset(DEFAULTS);
      onCreated();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to create rule");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add access rule</DialogTitle>
          <DialogDescription>
            Keyed by identifier (login identifier) or MAC address.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keyed by</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="identifier">Identifier</SelectItem>
                      <SelectItem value="device">MAC address</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {kind === "identifier" ? (
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identifier</FormLabel>
                    <FormControl>
                      <Input placeholder="+1-555-0100 or guest@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="macAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MAC address</FormLabel>
                    <FormControl>
                      <Input placeholder="AA:BB:CC:DD:EE:FF" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
            <FormField
              control={form.control}
              name="ruleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                      <SelectItem value="blocklist">Blocklist</SelectItem>
                      <SelectItem value="whitelist">Whitelist</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {ruleType === "temporary" && (
              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expires at</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Create rule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CheckAccessTool() {
  const check = useCheckAccess();
  const { data: organizations = [] } = useQuery({
    queryKey: ["guests", "org-options"],
    queryFn: () => guestService.organizations(),
  });
  const form = useForm<AccessCheckFormValues>({
    resolver: zodResolver(accessCheckSchema),
    defaultValues: { organizationId: "", locationId: "", identifier: "", macAddress: "" },
  });

  async function submit(values: AccessCheckFormValues) {
    check.mutate({
      organizationId: values.organizationId,
      locationId: values.locationId || undefined,
      identifier: values.identifier || undefined,
      macAddress: values.macAddress || undefined,
    });
  }

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Check access</CardTitle>
        <p className="text-xs text-muted-foreground">
          Runs the exact resolver real logins use — preview a decision without a guest connecting.
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="flex flex-wrap items-end gap-3">
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Organization</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-48">
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
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Identifier</FormLabel>
                  <FormControl>
                    <Input className="w-48" placeholder="optional" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="macAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">MAC address</FormLabel>
                  <FormControl>
                    <Input className="w-48" placeholder="optional" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" variant="outline" disabled={check.isPending}>
              Check
            </Button>
          </form>
        </Form>
        {check.data && (
          <div className="mt-4 rounded-lg border border-border/60 p-3 text-sm">
            <span className={check.data.allowed ? "text-emerald-600" : "text-rose-600"}>
              {check.data.allowed ? "Allowed" : "Denied"}
            </span>
            {check.data.ruleType && (
              <>
                {" "}
                — matched <AccessRuleTypeBadge type={check.data.ruleType} />
              </>
            )}
            {check.data.reason && (
              <p className="mt-1 text-xs text-muted-foreground">{check.data.reason}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
