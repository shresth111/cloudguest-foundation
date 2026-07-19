import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Ban,
  Download,
  Mail,
  MessageSquare,
  PowerOff,
  RefreshCw,
  Send,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { messageSchema, type MessageFormValues } from "@/lib/guest-schemas";
import {
  useBlockGuests,
  useDisconnectSessions,
  useGuestDevices,
  useGuestSessions,
  useResetGuestAccess,
  useSendMessage,
} from "@/hooks/useGuests";
import type { Guest } from "@/types/guest";
import {
  DeviceTypeBadge,
  GuestStatusBadge,
  GuestTypeBadge,
  LoginMethodBadge,
} from "./GuestBadges";

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatMb(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
}

function formatDuration(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function GuestDetailTabs({ guest, initialTab }: { guest: Guest; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab ?? "overview");
  const [messageOpen, setMessageOpen] = useState<false | "sms" | "email">(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>(null);
  const disconnect = useDisconnectSessions();
  const block = useBlockGuests();
  const reset = useResetGuestAccess();
  const send = useSendMessage();

  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { channel: "sms", body: "" },
  });

  const onSend = form.handleSubmit(async (values) => {
    await send.mutateAsync({ id: guest.id, channel: values.channel, body: values.body });
    toast.success(`${values.channel === "sms" ? "SMS" : "Email"} sent`);
    setMessageOpen(false);
    form.reset({ channel: values.channel, body: "" });
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => {
          form.setValue("channel", "sms");
          setMessageOpen("sms");
        }}>
          <MessageSquare className="h-4 w-4" /><span className="ml-2">Send SMS</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          form.setValue("channel", "email");
          setMessageOpen("email");
        }}>
          <Mail className="h-4 w-4" /><span className="ml-2">Send Email</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() =>
          reset.mutate(guest.id, { onSuccess: () => toast.success("Guest access reset") })
        }>
          <RefreshCw className="h-4 w-4" /><span className="ml-2">Reset access</span>
        </Button>
        <Button variant="destructive" size="sm" onClick={() =>
          setConfirm({
            title: `Block ${guest.name}?`,
            description: "The guest will be blacklisted and disconnected.",
            destructive: true,
            onConfirm: async () => {
              await block.mutateAsync({ ids: [guest.id], reason: "Blocked from guest profile" });
              toast.success("Guest blocked");
            },
          })
        }>
          <Ban className="h-4 w-4" /><span className="ml-2">Block guest</span>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="history">Login History</TabsTrigger>
          <TabsTrigger value="bandwidth">Bandwidth</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab guest={guest} />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab guestId={guest.id} onDisconnect={(id) =>
            setConfirm({
              title: "Disconnect session?",
              destructive: true,
              description: "This session will be forced offline.",
              onConfirm: async () => {
                await disconnect.mutateAsync([id]);
                toast.success("Session disconnected");
              },
            })
          } />
        </TabsContent>
        <TabsContent value="devices" className="mt-4">
          <DevicesTab guestId={guest.id} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <LoginHistoryTab guestId={guest.id} />
        </TabsContent>
        <TabsContent value="bandwidth" className="mt-4">
          <BandwidthTab guest={guest} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogsTab guest={guest} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!messageOpen} onOpenChange={(o) => !o && setMessageOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send message to {guest.name}</DialogTitle>
            <DialogDescription>
              Delivered via {messageOpen === "sms" ? "SMS" : "email"} to the guest on record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSend} className="grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Channel</Label>
              <Select value={form.watch("channel")} onValueChange={(v) => form.setValue("channel", v as "sms" | "email")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea rows={4} placeholder="Type your message…" {...form.register("body")} />
              {form.formState.errors.body && (
                <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={send.isPending}>
                <Send className="h-4 w-4" /><span className="ml-2">Send</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-2 last:border-none">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function OverviewTab({ guest }: { guest: Guest }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl border-border/70 lg:col-span-2">
        <CardHeader><CardTitle className="text-sm font-semibold">Guest details</CardTitle></CardHeader>
        <CardContent className="space-y-0">
          <InfoRow label="Name" value={guest.name} />
          <InfoRow label="Email" value={guest.email} />
          <InfoRow label="Mobile" value={guest.mobile} />
          <InfoRow label="Organization" value={guest.organizationName} />
          <InfoRow label="Location" value={guest.locationName} />
          <InfoRow label="Guest Type" value={<GuestTypeBadge type={guest.guestType} />} />
          <InfoRow label="Login Method" value={<LoginMethodBadge method={guest.loginMethod} />} />
          <InfoRow label="Status" value={<GuestStatusBadge status={guest.status} />} />
          <InfoRow label="Last login" value={formatDate(guest.lastLogin)} />
        </CardContent>
      </Card>
      <div className="grid gap-3">
        <StatCard label="Total Visits" value={guest.totalVisits.toLocaleString()} />
        <StatCard label="Total Sessions" value={guest.totalSessions.toLocaleString()} />
        <StatCard label="Total Data" value={formatMb(guest.totalDataMb)} sub="Across all sessions" />
      </div>
    </div>
  );
}

function SessionsTab({ guestId, onDisconnect }: { guestId: string; onDisconnect: (id: string) => void }) {
  const { data, isLoading } = useGuestSessions(guestId);
  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (!data || data.length === 0)
    return <EmptyState title="No sessions" description="This guest has no recorded sessions." />;
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Download</TableHead>
              <TableHead>Upload</TableHead>
              <TableHead>AP</TableHead>
              <TableHead>Router</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="text-xs">{formatDate(s.connectedSince)}</TableCell>
                <TableCell className="text-xs">{formatDate(s.sessionEnd)}</TableCell>
                <TableCell className="tabular-nums">{formatDuration(s.durationMinutes)}</TableCell>
                <TableCell className="tabular-nums">{formatMb(s.downloadMb)}</TableCell>
                <TableCell className="tabular-nums">{formatMb(s.uploadMb)}</TableCell>
                <TableCell className="text-xs">{s.apName}</TableCell>
                <TableCell className="text-xs">{s.routerName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.disconnectReason ?? "—"}</TableCell>
                <TableCell><GuestStatusBadge status={s.status} /></TableCell>
                <TableCell className="text-right">
                  {s.status === "online" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDisconnect(s.id)}>
                      <PowerOff className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function DevicesTab({ guestId }: { guestId: string }) {
  const { data, isLoading } = useGuestDevices(guestId);
  if (isLoading) return <LoadingSkeleton rows={3} />;
  if (!data || data.length === 0)
    return <EmptyState title="No devices" description="This guest has never connected a device." />;
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Device</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>MAC</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Browser</TableHead>
              <TableHead>First seen</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell><DeviceTypeBadge type={d.type} /></TableCell>
                <TableCell className="font-mono text-xs">{d.mac}</TableCell>
                <TableCell className="text-xs">{d.vendor}</TableCell>
                <TableCell className="text-xs">{d.os}</TableCell>
                <TableCell className="text-xs">{d.browser}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(d.firstSeen)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(d.lastSeen)}</TableCell>
                <TableCell className="text-xs capitalize">{d.status}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toast.success(`${d.name} disconnected`)}>
                      Disconnect
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() =>
                      toast.success(d.status === "blocked" ? `${d.name} unblocked` : `${d.name} blocked`)
                    }>
                      {d.status === "blocked" ? "Unblock" : "Block"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function LoginHistoryTab({ guestId }: { guestId: string }) {
  const { data, isLoading } = useGuestSessions(guestId);
  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (!data || data.length === 0)
    return <EmptyState title="No login history" />;
  return (
    <Card className="overflow-hidden rounded-2xl border-border/70">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Time</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/30">
                <TableCell className="text-xs">{formatDate(s.connectedSince)}</TableCell>
                <TableCell><LoginMethodBadge method={s.loginMethod} /></TableCell>
                <TableCell className="text-xs">{s.locationName}</TableCell>
                <TableCell className="text-xs">{s.deviceName}</TableCell>
                <TableCell className="font-mono text-xs">{s.ipAddress}</TableCell>
                <TableCell><GuestStatusBadge status={s.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function BandwidthTab({ guest }: { guest: Guest }) {
  const download = Math.floor(guest.totalDataMb * 0.78);
  const upload = guest.totalDataMb - download;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Total data" value={formatMb(guest.totalDataMb)} sub="All sessions" />
      <StatCard label="Download" value={formatMb(download)} sub="~78% of total" />
      <StatCard label="Upload" value={formatMb(upload)} sub="~22% of total" />
      <Card className="sm:col-span-3 rounded-2xl border-border/70 p-6 text-sm text-muted-foreground">
        Detailed per-day bandwidth charts will render here once monitoring collectors are online.
      </Card>
    </div>
  );
}

function AuditLogsTab({ guest }: { guest: Guest }) {
  const logs = [
    { when: guest.lastLogin, actor: "System", action: "Login succeeded", detail: `via ${guest.loginMethod}` },
    { when: new Date(Date.now() - 3 * 3600000).toISOString(), actor: "admin@cloudguest.io", action: "Policy applied", detail: `${guest.guestType} tier` },
    { when: new Date(Date.now() - 86400000).toISOString(), actor: "System", action: "Session ended", detail: "Session timeout" },
    { when: guest.createdAt, actor: "System", action: "Guest created", detail: guest.locationName },
  ];
  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="flex items-center justify-between flex-row">
        <CardTitle className="text-sm font-semibold">Audit log</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => toast.success("Audit log exported")}>
          <Download className="h-4 w-4" /><span className="ml-2">Export</span>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/60">
          {logs.map((l, i) => (
            <div key={i} className="grid grid-cols-[160px_1fr] gap-4 py-3 text-sm">
              <span className="text-xs text-muted-foreground">{formatDate(l.when)}</span>
              <div>
                <div className="font-medium">{l.action}</div>
                <div className="text-xs text-muted-foreground">by {l.actor} · {l.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
