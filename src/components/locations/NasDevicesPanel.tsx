import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { Copy, Loader2, Plus, Router as RouterIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useAuth } from "@/context/AuthContext";
import { legacyRoleBucket } from "@/lib/roles";
import { nasRegisterSchema, type NasRegisterValues } from "@/lib/nas-schemas";
import { useCreateNas, useLocationNas } from "@/hooks/useNas";
import { useRouters } from "@/hooks/useRouters";
import { NAS_STATUS_LABEL, type NasClientSecretReveal } from "@/types/nas";
import type { AppError } from "@/services/api";

interface Props {
  locationId: string;
}

const STATUS_TONE: Record<string, string> = {
  active: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  pending: "border-zinc-500/30 text-zinc-600 dark:text-zinc-400",
  disabled: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  suspended: "border-fuchsia-500/30 text-fuchsia-600 dark:text-fuchsia-400",
  deleted: "border-rose-500/30 text-rose-600 dark:text-rose-400",
};

export function NasDevicesPanel({ locationId }: Props) {
  const { data, isLoading } = useLocationNas(locationId);
  const { roles } = useAuth();
  const canRegister = legacyRoleBucket(roles) === "super_admin";
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) return <LoadingSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">NAS devices</h3>
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} RADIUS client{data?.length === 1 ? "" : "s"} registered at this
            location.
          </p>
        </div>
        {canRegister && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="ml-2">Register NAS</span>
          </Button>
        )}
      </div>

      {!data || data.length === 0 ? (
        <EmptyState
          icon={RouterIcon}
          title="No NAS registered"
          description="Register a NAS against an existing router to start onboarding guests at this location."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((n) => (
            <Card key={n.id} className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-tight">
                      {n.nasCode ?? n.nasIdentifier}
                    </CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.nasIdentifier}</p>
                  </div>
                  <Badge variant="outline" className={STATUS_TONE[n.status] ?? ""}>
                    {NAS_STATUS_LABEL[n.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{n.name ?? "Unnamed"}</span>
                  <span className="font-mono">{n.vendor}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <Link
                    to="/routers/$routerId"
                    params={{ routerId: n.routerId }}
                    className="text-xs text-primary hover:underline"
                  >
                    View router
                  </Link>
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      to="/locations/$locationId/nas/$nasId"
                      params={{ locationId, nasId: n.id }}
                    >
                      Open
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RegisterNasDialog
        locationId={locationId}
        existingRouterIds={(data ?? []).map((n) => n.routerId)}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

const DEFAULTS: NasRegisterValues = {
  routerId: "",
  nasIdentifier: "",
  sharedSecret: "",
  name: "",
  description: "",
  ipAddress: "",
};

function RegisterNasDialog({
  locationId,
  existingRouterIds,
  open,
  onOpenChange,
}: {
  locationId: string;
  existingRouterIds: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateNas();
  const [reveal, setReveal] = useState<NasClientSecretReveal | null>(null);
  const { data: routerList } = useRouters({ locationId, page: 1, pageSize: 100 });

  const availableRouters = useMemo(
    () => (routerList?.rows ?? []).filter((r) => !existingRouterIds.includes(r.id)),
    [routerList, existingRouterIds],
  );

  const form = useForm<NasRegisterValues>({
    resolver: zodResolver(nasRegisterSchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  async function submit(values: NasRegisterValues) {
    try {
      const result = await create.mutateAsync({
        locationId,
        payload: {
          routerId: values.routerId,
          nasIdentifier: values.nasIdentifier,
          sharedSecret: values.sharedSecret || undefined,
          name: values.name || undefined,
          description: values.description || undefined,
          ipAddress: values.ipAddress || undefined,
        },
      });
      setReveal(result);
      form.reset(DEFAULTS);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to register NAS");
    }
  }

  function close(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setReveal(null);
      form.reset(DEFAULTS);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        {reveal ? (
          <>
            <DialogHeader>
              <DialogTitle>NAS registered — shared secret shown once</DialogTitle>
              <DialogDescription>
                Configure the router's RADIUS client with this secret now. It will not be shown
                again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                NAS code
                <div className="font-mono text-sm text-foreground">{reveal.nasCode ?? "—"}</div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                <div>
                  <div className="text-xs text-muted-foreground">Shared secret</div>
                  <code className="text-sm">{reveal.sharedSecret}</code>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(reveal.sharedSecret);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Register NAS</DialogTitle>
              <DialogDescription>
                Attach a RADIUS client to an existing router at this location.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="routerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Router</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                availableRouters.length === 0
                                  ? "No routers without a NAS at this location"
                                  : "Select router"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableRouters.map((r) => (
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
                  control={form.control}
                  name="nasIdentifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NAS identifier</FormLabel>
                      <FormControl>
                        <Input placeholder="cg-lobby-01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sharedSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shared secret (optional — auto-generated if left blank)</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Lobby NAS" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ipAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP address (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Defaults to router IP" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span className={create.isPending ? "ml-2" : ""}>Register</span>
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
