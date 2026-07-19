import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { blacklistSchema, whitelistSchema, type BlacklistFormValues, type WhitelistFormValues } from "@/lib/guest-schemas";
import {
  useAddBlacklist,
  useAddWhitelist,
  useBlacklist,
  useRemoveBlacklist,
  useRemoveWhitelist,
  useWhitelist,
} from "@/hooks/useGuests";

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function BlacklistPanel() {
  const { data, isLoading, isError, refetch } = useBlacklist();
  const add = useAddBlacklist();
  const remove = useRemoveBlacklist();
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const form = useForm<BlacklistFormValues>({
    resolver: zodResolver(blacklistSchema),
    defaultValues: { guestName: "", mac: "", mobile: "", email: "", reason: "", expiresAt: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await add.mutateAsync({
      guestName: values.guestName,
      mac: values.mac,
      mobile: values.mobile,
      email: values.email,
      reason: values.reason,
      expiresAt: values.expiresAt || undefined,
    });
    toast.success("Guest blacklisted");
    setOpen(false);
    form.reset();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Blacklist</h3>
          <p className="text-sm text-muted-foreground">Guests, devices and MACs blocked from all networks.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /><span className="ml-2">Add to blacklist</span>
        </Button>
      </div>
      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={5} /></div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={Ban} title="Blacklist is empty" description="Blocked guests will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Guest</TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Blocked</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((b) => (
                  <TableRow key={b.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{b.guestName}</TableCell>
                    <TableCell className="font-mono text-xs">{b.mac}</TableCell>
                    <TableCell className="text-xs">{b.mobile}</TableCell>
                    <TableCell className="text-xs">{b.email}</TableCell>
                    <TableCell className="text-xs">{b.reason}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(b.blockedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(b.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirmId(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to blacklist</DialogTitle>
            <DialogDescription>Prevent this guest from connecting to any WiFi network.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-3">
            <FormField label="Guest name" error={form.formState.errors.guestName?.message}>
              <Input {...form.register("guestName")} placeholder="Full name" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="MAC address" error={form.formState.errors.mac?.message}>
                <Input {...form.register("mac")} placeholder="AA:BB:CC:DD:EE:FF" />
              </FormField>
              <FormField label="Mobile" error={form.formState.errors.mobile?.message}>
                <Input {...form.register("mobile")} placeholder="+1-555-1234" />
              </FormField>
            </div>
            <FormField label="Email" error={form.formState.errors.email?.message}>
              <Input {...form.register("email")} placeholder="guest@mail.com" />
            </FormField>
            <FormField label="Reason" error={form.formState.errors.reason?.message}>
              <Input {...form.register("reason")} placeholder="e.g. Policy violation" />
            </FormField>
            <FormField label="Expires (optional)">
              <Input type="date" {...form.register("expiresAt")} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={add.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Remove from blacklist?"
        description="This will allow the guest to reconnect."
        destructive
        onConfirm={async () => {
          if (!confirmId) return;
          await remove.mutateAsync([confirmId]);
          toast.success("Removed from blacklist");
          setConfirmId(null);
        }}
      />
    </div>
  );
}

export function WhitelistPanel() {
  const { data, isLoading, isError, refetch } = useWhitelist();
  const add = useAddWhitelist();
  const remove = useRemoveWhitelist();
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const form = useForm<WhitelistFormValues>({
    resolver: zodResolver(whitelistSchema),
    defaultValues: { guestName: "", mac: "", mobile: "", email: "", note: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await add.mutateAsync(values);
    toast.success("Guest whitelisted");
    setOpen(false);
    form.reset();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Whitelist</h3>
          <p className="text-sm text-muted-foreground">Trusted guests bypass captive portal and enjoy priority access.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /><span className="ml-2">Add to whitelist</span>
        </Button>
      </div>
      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={5} /></div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Whitelist is empty" description="Trusted guests will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Guest</TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((w) => (
                  <TableRow key={w.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{w.guestName}</TableCell>
                    <TableCell className="font-mono text-xs">{w.mac}</TableCell>
                    <TableCell className="text-xs">{w.mobile}</TableCell>
                    <TableCell className="text-xs">{w.email}</TableCell>
                    <TableCell className="text-xs">{w.note}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(w.addedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirmId(w.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to whitelist</DialogTitle>
            <DialogDescription>Grant this guest trusted access across all networks.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-3">
            <FormField label="Guest name" error={form.formState.errors.guestName?.message}>
              <Input {...form.register("guestName")} placeholder="Full name" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="MAC address" error={form.formState.errors.mac?.message}>
                <Input {...form.register("mac")} placeholder="AA:BB:CC:DD:EE:FF" />
              </FormField>
              <FormField label="Mobile" error={form.formState.errors.mobile?.message}>
                <Input {...form.register("mobile")} placeholder="+1-555-1234" />
              </FormField>
            </div>
            <FormField label="Email" error={form.formState.errors.email?.message}>
              <Input {...form.register("email")} placeholder="guest@mail.com" />
            </FormField>
            <FormField label="Note" error={form.formState.errors.note?.message}>
              <Input {...form.register("note")} placeholder="e.g. VIP guest" />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={add.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Remove from whitelist?"
        destructive
        onConfirm={async () => {
          if (!confirmId) return;
          await remove.mutateAsync([confirmId]);
          toast.success("Removed from whitelist");
          setConfirmId(null);
        }}
      />
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
