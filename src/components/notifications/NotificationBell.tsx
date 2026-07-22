import { useState } from "react";
import { Bell, Check, Archive, ExternalLink, AlertOctagon, Router, User, CreditCard, Wrench, Palette, Wifi, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useNavigate } from "@tanstack/react-router";

interface Notification {
  id: string;
  icon: typeof Bell;
  title: string;
  description: string;
  time: string;
  status: "unread" | "read";
  category: string;
}

const NOTIFICATIONS: Notification[] = [
  { id: "n1", icon: Router, title: "Router OFFLINE", description: "Router GW-02 at Mumbai HQ went offline", time: "2 min ago", status: "unread", category: "system" },
  { id: "n2", icon: User, title: "Guest Connected", description: "John Doe connected at Delhi Office", time: "5 min ago", status: "unread", category: "provisioning" },
  { id: "n3", icon: Shield, title: "Security Alert", description: "Multiple failed login attempts detected", time: "12 min ago", status: "unread", category: "security" },
  { id: "n4", icon: CreditCard, title: "Invoice Generated", description: "Invoice #INV-2024-0421 is ready", time: "1 hr ago", status: "unread", category: "billing" },
  { id: "n5", icon: AlertOctagon, title: "SLA Warning", description: "Uptime below 99.9% at Bangalore DC", time: "2 hr ago", status: "read", category: "alerts" },
  { id: "n6", icon: Palette, title: "Portal Published", description: "Guest portal for Chennai Office is live", time: "3 hr ago", status: "read", category: "system" },
  { id: "n7", icon: Wrench, title: "Maintenance Window", description: "Scheduled maintenance in 24 hours", time: "5 hr ago", status: "read", category: "system" },
  { id: "n8", icon: Wifi, title: "Voucher Generated", description: "500 vouchers generated for Hyderabad", time: "6 hr ago", status: "read", category: "provisioning" },
];

const CATEGORY_TABS = ["all", "system", "provisioning", "security", "billing", "alerts"] as const;
type Tab = (typeof CATEGORY_TABS)[number];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const navigate = useNavigate();
  const unreadCount = NOTIFICATIONS.filter((n) => n.status === "unread").length;

  const filtered = tab === "all" ? NOTIFICATIONS : NOTIFICATIONS.filter((n) => n.category === tab);

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
      <DropdownMenuContent align="end" className="w-[400px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
            <Check className="mr-1 h-3 w-3" /> Mark all read
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex gap-1 border-b border-border px-2 pb-2">
          {CATEGORY_TABS.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                tab === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <DropdownMenuGroup className="max-h-[320px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            filtered.map((n) => {
              const Icon = n.icon;
              return (
                <DropdownMenuItem
                  key={n.id}
                  className={cn("flex items-start gap-3 px-4 py-3", n.status === "unread" && "bg-muted/50")}
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.status === "unread" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{n.time}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Archive className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setOpen(false); navigate({ to: "/notifications" }); }}>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center text-sm font-medium text-primary" onSelect={() => { setOpen(false); navigate({ to: "/notifications" }); }}>
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
