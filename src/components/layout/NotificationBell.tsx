import { AlertOctagon, Bell, CreditCard, Info, ShieldAlert, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useDashboardData";
import type { NotificationKind } from "@/types/dashboard";

const ICONS: Record<NotificationKind, typeof Bell> = {
  alert: AlertOctagon,
  warning: ShieldAlert,
  billing: CreditCard,
  router: Wifi,
  subscription: Bell,
  system: Info,
};

const KIND_TONE: Record<NotificationKind, string> = {
  alert: "text-indigo-500 bg-indigo-500/10",
  warning: "text-amber-500 bg-amber-500/10",
  billing: "text-rose-500 bg-rose-500/10",
  router: "text-sky-500 bg-sky-500/10",
  subscription: "text-emerald-500 bg-emerald-500/10",
  system: "text-slate-500 bg-slate-500/10",
};

export function NotificationBell() {
  const { data, isLoading, isError, refetch } = useNotifications();
  const unread = data?.filter((n) => n.unread).length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
          <button className="text-xs font-medium text-primary hover:underline">Mark all as read</button>
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80">
          {isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          )}
          {isError && (
            <div className="flex flex-col items-center gap-2 p-6 text-sm text-muted-foreground">
              Failed to load.
              <button className="text-primary hover:underline" onClick={() => refetch()}>Retry</button>
            </div>
          )}
          {!isLoading && !isError && data && data.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
          )}
          <ul className="divide-y divide-border">
            {data?.map((n) => {
              const Icon = ICONS[n.kind];
              return (
                <li key={n.id} className="flex items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/50">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${KIND_TONE[n.kind]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{n.at}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button variant="ghost" size="sm" className="w-full justify-center">
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
