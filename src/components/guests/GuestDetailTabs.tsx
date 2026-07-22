import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Plug, PowerOff, ShieldCheck } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  blockGuestSchema,
  reconnectSchema,
  type BlockGuestFormValues,
  type ReconnectFormValues,
} from "@/lib/guest-schemas";
import {
  useBlockGuest,
  useDisconnectSession,
  useGuestSessions,
  useReconnectGuest,
  useTerminateSession,
  useUnblockGuest,
} from "@/hooks/useGuests";
import { useRouters } from "@/hooks/useRouters";
import type { Guest } from "@/types/guest";
import type { AppError } from "@/services/api";
import { GuestAuthMethodBadge, GuestSessionStatusBadge } from "./GuestBadges";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatBytes(n: number) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

export function GuestDetailTabs({ guest, initialTab }: { guest: Guest; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab ?? "overview");
  const [blockOpen, setBlockOpen] = useState(false);
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const block = useBlockGuest();
  const unblock = useUnblockGuest();
  const reconnect = useReconnectGuest();

  const blockForm = useForm<BlockGuestFormValues>({
    resolver: zodResolver(blockGuestSchema),
    defaultValues: { reason: "" },
  });
  const reconnectForm = useForm<ReconnectFormValues>({
    resolver: zodResolver(reconnectSchema),
    defaultValues: {
      routerId: "",
      locationId: guest.locationId ?? "",
      deviceMac: "",
      ipAddress: "",
    },
  });

  const { data: routerList } = useRouters({
    locationId: guest.locationId ?? "all",
    page: 1,
    pageSize: 100,
  });

  async function onBlock(values: BlockGuestFormValues) {
    try {
      await block.mutateAsync({ guestId: guest.id, reason: values.reason });
      toast.success("Guest blocked");
      setBlockOpen(false);
      blockForm.reset();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to block guest");
    }
  }

  async function onUnblock() {
    try {
      await unblock.mutateAsync(guest.id);
      toast.success("Guest unblocked");
    } catch (err) {
      toast.error((err as AppError).message || "Failed to unblock guest");
    }
  }

  async function onReconnect(values: ReconnectFormValues) {
    try {
      await reconnect.mutateAsync({
        guestId: guest.id,
        payload: {
          routerId: values.routerId,
          locationId: values.locationId,
          deviceMac: values.deviceMac || undefined,
          ipAddress: values.ipAddress || undefined,
        },
      });
      toast.success("Guest reconnected");
      setReconnectOpen(false);
      reconnectForm.reset();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to reconnect guest");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setReconnectOpen(true)}>
          <Plug className="h-4 w-4" />
          <span className="ml-2">Reconnect</span>
        </Button>
        {guest.isBlocked ? (
          <Button variant="outline" size="sm" onClick={onUnblock} disabled={unblock.isPending}>
            <ShieldCheck className="h-4 w-4" />
            <span className="ml-2">Unblock</span>
          </Button>
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setBlockOpen(true)}>
            <Ban className="h-4 w-4" />
            <span className="ml-2">Block guest</span>
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab guest={guest} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab guestId={guest.id} />
        </TabsContent>
      </Tabs>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block guest</DialogTitle>
            <DialogDescription>The guest will be denied access until unblocked.</DialogDescription>
          </DialogHeader>
          <Form {...blockForm}>
            <form onSubmit={blockForm.handleSubmit(onBlock)} className="space-y-4">
              <FormField
                control={blockForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="Policy violation, abuse, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={block.isPending}>
                  Block
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={reconnectOpen} onOpenChange={setReconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconnect guest</DialogTitle>
            <DialogDescription>Admin-initiated reconnect on a specific router.</DialogDescription>
          </DialogHeader>
          <Form {...reconnectForm}>
            <form onSubmit={reconnectForm.handleSubmit(onReconnect)} className="space-y-4">
              <FormField
                control={reconnectForm.control}
                name="routerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Router</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select router" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(routerList?.rows ?? []).map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reconnectForm.control}
                name="deviceMac"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device MAC (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="AA:BB:CC:DD:EE:FF" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reconnectForm.control}
                name="ipAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP address (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={reconnect.isPending}>
                  Reconnect
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-2 last:border-none">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function OverviewTab({ guest }: { guest: Guest }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl border-border/70 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Guest details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <InfoRow label="Identifier" value={guest.identifier} />
          <InfoRow label="Display name" value={guest.displayName ?? "—"} />
          <InfoRow label="Organization" value={guest.organizationName} />
          <InfoRow label="Location" value={guest.locationName ?? "—"} />
          <InfoRow label="Status" value={guest.isBlocked ? "Blocked" : "Active"} />
          {guest.isBlocked && <InfoRow label="Blocked reason" value={guest.blockedReason ?? "—"} />}
          <InfoRow label="First seen" value={formatDate(guest.firstSeenAt)} />
          <InfoRow label="Last seen" value={formatDate(guest.lastSeenAt)} />
        </CardContent>
      </Card>
      <div className="grid gap-3">
        <StatCard label="Total Visits" value={guest.totalVisitCount.toLocaleString()} />
      </div>
    </div>
  );
}

function SessionsTab({ guestId }: { guestId: string }) {
  const { data, isLoading } = useGuestSessions(guestId);
  const disconnect = useDisconnectSession();
  const terminate = useTerminateSession();
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>(null);

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (!data || data.length === 0)
    return <EmptyState title="No sessions" description="This guest has no recorded sessions." />;

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-border/70">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Down</TableHead>
                <TableHead className="text-right">Up</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => {
                const canAct = s.status === "active" || s.status === "paused";
                return (
                  <TableRow key={s.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs">{formatDate(s.startedAt)}</TableCell>
                    <TableCell className="text-xs">{formatDate(s.endedAt)}</TableCell>
                    <TableCell>
                      <GuestAuthMethodBadge method={s.authMethod} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBytes(s.bytesDownloaded)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBytes(s.bytesUploaded)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.disconnectReason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <GuestSessionStatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {canAct && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Disconnect"
                            onClick={() =>
                              setConfirm({
                                title: "Disconnect session?",
                                destructive: true,
                                description: "This session will be forced offline.",
                                onConfirm: async () => {
                                  try {
                                    await disconnect.mutateAsync({ sessionId: s.id });
                                    toast.success("Session disconnected");
                                  } catch (err) {
                                    toast.error(
                                      (err as AppError).message || "Failed to disconnect",
                                    );
                                  }
                                },
                              })
                            }
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Terminate"
                            onClick={() =>
                              setConfirm({
                                title: "Terminate session?",
                                destructive: true,
                                description:
                                  "Punitive — imposes a 60-minute reconnect cooldown for this guest.",
                                onConfirm: async () => {
                                  try {
                                    await terminate.mutateAsync({ sessionId: s.id });
                                    toast.success("Session terminated");
                                  } catch (err) {
                                    toast.error((err as AppError).message || "Failed to terminate");
                                  }
                                },
                              })
                            }
                          >
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
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
    </>
  );
}
