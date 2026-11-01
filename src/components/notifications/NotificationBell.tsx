import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Activity, AlertTriangle, Bell, Check, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAcknowledgeAlert, useAlertsFeed, type AlertsFeedScope } from "@/hooks/useAlerts";
import type { Alert as AlertNotification, AlertSeverity } from "@/types/monitoring";

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function severityIcon(severity: AlertSeverity) {
  if (severity === "critical") return <XCircle className="h-4 w-4 text-rose-500" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <Activity className="h-4 w-4 text-sky-500" />;
}

export interface NotificationBellProps {
  /** "org" -- current signed-in customer's own organization only.
   *  "platform" -- every organization, Super Admin / master console only. */
  scope: AlertsFeedScope;
  /** Destination for the "View all alerts" footer link. Omit when there's
   * nowhere real to send the click (e.g. no locationId yet, or no
   * dedicated platform-wide alerts page exists). */
  viewAllPath?: string;
  /** Customer shell only: the venue's shared issue list (the same one the
   * health pill and the Dashboard's Needs-attention card show). When given,
   * the badge counts THESE -- open alerts are already on it as a row -- and
   * the menu lists them first, so the bell can never say "No new
   * notifications" while the pill says something is wrong. */
  attention?: {
    heading: string;
    /** Whether open alerts are already rows of `items`. */
    includesAlerts: boolean;
    items: {
      key: string;
      title: string;
      severity: AlertSeverity;
      href: string | null;
      action?: string;
    }[];
  };
}

export function NotificationBell({ scope, viewAllPath, attention }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: alerts = [], isLoading } = useAlertsFeed(scope);
  const acknowledge = useAcknowledgeAlert(scope);

  const unread = useMemo(
    () => alerts.filter((a: AlertNotification) => a.status === "triggered"),
    [alerts],
  );
  const attentionItems = attention?.items ?? [];
  // The shared list already carries open alerts as rows when it was built
  // from them; otherwise (a router-only list) unread alerts add on top.
  const unreadCount = attention
    ? attentionItems.length + (attention.includesAlerts ? 0 : unread.length)
    : unread.length;

  const markAllRead = () => {
    for (const a of unread) acknowledge.mutate(a.id);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={acknowledge.isPending}
              onClick={markAllRead}
            >
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {attentionItems.length > 0 && (
          <>
            <DropdownMenuGroup data-testid="bell-attention">
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {attention?.heading}
              </p>
              {attentionItems.map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  className="flex items-start gap-3 px-4 py-2.5"
                  onSelect={() => {
                    if (!item.href) return;
                    setOpen(false);
                    navigate({ to: item.href });
                  }}
                >
                  <span className="mt-0.5 shrink-0">{severityIcon(item.severity)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.title}</span>
                    {item.href && item.action && (
                      <span className="block text-xs text-primary">{item.action} →</span>
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup className="max-h-[360px] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : alerts.length === 0 ? (
            attentionItems.length > 0 ? null : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No new notifications
              </div>
            )
          ) : (
            alerts.slice(0, 8).map((a: AlertNotification) => (
              <DropdownMenuItem
                key={a.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  a.status === "triggered" && "bg-muted/50",
                )}
                onSelect={(e) => e.preventDefault()}
              >
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                  {severityIcon(a.severity)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{a.message}</p>
                    {a.status === "triggered" && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs capitalize text-muted-foreground">
                    {timeAgo(a.triggeredAt)} · {a.status}
                  </p>
                </div>
                {a.status === "triggered" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    aria-label="Acknowledge"
                    disabled={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(a.id)}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        {viewAllPath && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-sm font-medium text-primary"
              onSelect={() => {
                setOpen(false);
                navigate({ to: viewAllPath });
              }}
            >
              View all alerts
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
