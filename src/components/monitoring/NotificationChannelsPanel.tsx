import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@/components/ui/switch";
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
import { ChannelTypeBadge, NotificationStatusBadge } from "./MonitoringBadges";
import {
  configFromNotificationChannelForm,
  notificationChannelSchema,
  type NotificationChannelFormValues,
} from "@/lib/monitoring-schemas";
import {
  useCreateNotificationChannel,
  useDeleteNotificationChannel,
  useNotificationChannels,
  useNotificationLogs,
  useOrgLocationLookup,
} from "@/hooks/useMonitoring";
import type { AppError } from "@/services/api";

const DEFAULTS: NotificationChannelFormValues = {
  name: "",
  organizationId: "",
  channelType: "webhook",
  isActive: true,
  email: "",
  phoneNumber: "",
  webhookUrl: "",
  url: "",
  authHeaderName: "",
  authHeaderValue: "",
};

export function NotificationChannelsPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch } = useNotificationChannels({ page, pageSize: 25 });
  const remove = useDeleteNotificationChannel();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const { orgName } = useOrgLocationLookup();

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Notification channels</h3>
          <p className="text-sm text-muted-foreground">
            Real delivery for Slack/Teams/Discord/Webhook (HTTP POST) and Email/SMS. WhatsApp is
            logged only — no WhatsApp Business API account is configured.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="ml-2">Add channel</span>
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={4} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notification channels"
            description="Add a channel so alert rules can actually deliver notifications somewhere."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <ChannelTypeBadge type={c.channelType} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {orgName(c.organizationId) ?? (c.organizationId ? c.organizationId.slice(0, 8) : "All")}
                    </TableCell>
                    <TableCell className="text-xs">{c.isActive ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ id: c.id, name: c.name })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                <span>
                  Page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!data.hasPrevious} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={!data.hasNext} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <NotificationLogsTable />

      <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => refetch()} />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete notification channel?"
        description={`"${confirmDelete?.name ?? ""}" will stop receiving alert notifications. Alert rules referencing it will simply skip it.`}
        destructive
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await remove.mutateAsync(confirmDelete.id);
            toast.success("Notification channel deleted");
          } catch (err) {
            toast.error((err as AppError).message || "Failed to delete");
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function CreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const create = useCreateNotificationChannel();
  const { organizations } = useOrgLocationLookup();

  const form = useForm<NotificationChannelFormValues>({
    resolver: zodResolver(notificationChannelSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  const channelType = form.watch("channelType");

  async function submit(values: NotificationChannelFormValues) {
    try {
      await create.mutateAsync({
        name: values.name,
        organizationId: values.organizationId || null,
        channelType: values.channelType,
        config: configFromNotificationChannelForm(values),
        isActive: values.isActive,
      });
      toast.success("Notification channel created");
      onOpenChange(false);
      form.reset(DEFAULTS);
      onCreated();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to create channel");
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
          <DialogTitle>Add notification channel</DialogTitle>
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization (optional — platform-wide if blank)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Platform-wide" />
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
              name="channelType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="webhook">Webhook (real HTTP POST)</SelectItem>
                      <SelectItem value="slack">Slack (real HTTP POST)</SelectItem>
                      <SelectItem value="teams">Microsoft Teams (real HTTP POST)</SelectItem>
                      <SelectItem value="discord">Discord (real HTTP POST)</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp (logged only)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {channelType === "email" && (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="ops@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {(channelType === "sms" || channelType === "whatsapp") && (
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl>
                      <Input placeholder="+15550102200" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {(channelType === "slack" || channelType === "teams" || channelType === "discord") && (
              <FormField
                control={form.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incoming webhook URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://hooks.slack.com/services/…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {channelType === "webhook" && (
              <>
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/webhook" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="authHeaderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth header name (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="X-Api-Key" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="authHeaderValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auth header value (optional)</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="!mt-0">Active</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Create channel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NotificationLogsTable() {
  const { data, isLoading } = useNotificationLogs({ page: 1, pageSize: 25 });
  const logs = data?.items ?? [];

  return (
    <Card className="overflow-hidden">
      <div className="border-b p-3">
        <h4 className="text-sm font-semibold">Recent delivery log</h4>
      </div>
      {isLoading ? (
        <div className="p-4">
          <LoadingSkeleton rows={3} />
        </div>
      ) : logs.length === 0 ? (
        <div className="p-6">
          <EmptyState title="No deliveries yet" description="Notifications will appear here once an alert fires with a channel attached." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent at</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(l.sentAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <NotificationStatusBadge status={l.status} />
                  </TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                    {l.errorMessage ?? l.responseSummary ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
