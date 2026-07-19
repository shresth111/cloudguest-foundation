import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertOctagon, Bell, Building2, CheckCheck, CreditCard, Palette, Router, ShieldAlert, User,
  Wifi, Wrench, Network,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import {
  useMarkAllRead, useNotifCenter,
} from "@/hooks/useSystem";
import type { NotifCategory, NotifPriority } from "@/services/system.service";

export const Route = createFileRoute("/_authenticated/notifications/")({
  component: NotificationsPage,
});

const ICON: Record<NotifCategory, typeof Bell> = {
  system: Bell, router: Router, guest: User, billing: CreditCard, subscription: Bell,
  security: ShieldAlert, maintenance: Wrench, portal: Palette, wifi: Wifi, wireguard: Network,
  alert: AlertOctagon,
};

const PRI_TONE: Record<NotifPriority, string> = {
  low: "bg-slate-500/15 text-slate-600",
  medium: "bg-sky-500/15 text-sky-600",
  high: "bg-amber-500/15 text-amber-600",
  critical: "bg-rose-500/15 text-rose-600",
};

function NotificationsPage() {
  const [category, setCategory] = useState<NotifCategory | "all">("all");
  const [priority, setPriority] = useState<NotifPriority | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const q = useNotifCenter({
    category: category === "all" ? undefined : category,
    priority: priority === "all" ? undefined : priority,
    unreadOnly,
  });
  const markAll = useMarkAllRead();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification center"
        description="All system, network, security, and billing alerts in one place."
        actions={
          <Button variant="outline" onClick={() => markAll.mutate(undefined, { onSuccess: () => toast.success("Marked all as read") })}>
            <CheckCheck className="mr-2 h-4 w-4" />Mark all read
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={(v) => setCategory(v as NotifCategory | "all")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(["system", "router", "guest", "billing", "subscription", "security", "maintenance", "portal", "wifi", "wireguard", "alert"] as NotifCategory[]).map((c) => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => setPriority(v as NotifPriority | "all")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {(["low", "medium", "high", "critical"] as NotifPriority[]).map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={unreadOnly ? "default" : "outline"} size="sm" onClick={() => setUnreadOnly((v) => !v)}>
          Unread only
        </Button>
      </div>

      {q.isLoading && <PageSkeleton />}
      {q.isError && <ErrorState onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <EmptyState title="No notifications match" description="Adjust filters or check back later." />
      )}

      <div className="space-y-2">
        {q.data?.map((n) => {
          const Icon = ICON[n.category] ?? Bell;
          return (
            <Card key={n.id} className={n.unread ? "border-primary/40" : ""}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{n.title}</p>
                    <Badge className={`${PRI_TONE[n.priority]} hover:${PRI_TONE[n.priority]} capitalize`}>{n.priority}</Badge>
                    <Badge variant="outline" className="capitalize">{n.category}</Badge>
                    {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.description}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {n.location && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{n.location}</span>}
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </p>
                </div>
                {n.action && (
                  <Button variant="ghost" size="sm">{n.action.label}</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
