import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Activity, MapPin, Router, Wifi, UserCheck, UserX, Ticket, Shield, Users, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RightDrawer } from "@/components/ui-ext/RightDrawer";
import { cn } from "@/lib/utils";

interface ActivityEvent {
  id: string;
  type: string;
  icon: typeof Activity;
  title: string;
  description: string;
  time: Date;
  user: string;
  tone: "default" | "success" | "warning" | "danger";
}

const EVENTS: ActivityEvent[] = [
  { id: "a1", type: "location", icon: MapPin, title: "Location Created", description: "New Delhi Office added", time: new Date(Date.now() - 60000), user: "Admin", tone: "success" },
  { id: "a2", type: "router", icon: Router, title: "Router Online", description: "GW-03 at Mumbai HQ is back online", time: new Date(Date.now() - 120000), user: "System", tone: "success" },
  { id: "a3", type: "router", icon: Router, title: "Router Offline", description: "GW-07 at Bangalore DC went offline", time: new Date(Date.now() - 300000), user: "System", tone: "danger" },
  { id: "a4", type: "guest", icon: Wifi, title: "Guest Connected", description: "John.Doe@email.com connected at Mumbai HQ", time: new Date(Date.now() - 600000), user: "System", tone: "success" },
  { id: "a5", type: "guest", icon: UserX, title: "Guest Disconnected", description: "Jane.Smith@email.com disconnected from Delhi Office", time: new Date(Date.now() - 900000), user: "System", tone: "warning" },
  { id: "a6", type: "voucher", icon: Ticket, title: "Voucher Generated", description: "500 vouchers created for Hyderabad location", time: new Date(Date.now() - 1800000), user: "Manager", tone: "default" },
  { id: "a7", type: "policy", icon: Shield, title: "Policy Updated", description: "Bandwidth policy changed for Chennai Office", time: new Date(Date.now() - 3600000), user: "Admin", tone: "warning" },
  { id: "a8", type: "campaign", icon: Globe, title: "Campaign Published", description: "Summer Promo campaign is now live", time: new Date(Date.now() - 7200000), user: "Marketing", tone: "success" },
  { id: "a9", type: "auth", icon: Users, title: "Admin Login", description: "Admin user logged in from 203.0.113.42", time: new Date(Date.now() - 10800000), user: "System", tone: "default" },
  { id: "a10", type: "guest", icon: UserCheck, title: "Guest Connected", description: "Alex.K@email.com connected at Bangalore DC", time: new Date(Date.now() - 14400000), user: "System", tone: "success" },
];

const TONE_COLORS = {
  default: "bg-muted text-foreground",
  success: "bg-emerald-500/15 text-emerald-600",
  warning: "bg-amber-500/15 text-amber-600",
  danger: "bg-rose-500/15 text-rose-600",
};

interface ActivityFeedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityFeed({ open, onOpenChange }: ActivityFeedProps) {
  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <span>Activity feed</span>
          <Badge variant="secondary" className="ml-1 text-[10px]">
            LIVE
          </Badge>
        </div>
      }
      description="Real-time events across your network"
      size="md"
    >
      <div className="relative space-y-0">
        {EVENTS.map((event, i) => {
          const Icon = event.icon;
          return (
            <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Timeline line */}
              {i < EVENTS.length - 1 && (
                <div className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />
              )}
              {/* Icon */}
              <div className={cn("relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full", TONE_COLORS[event.tone])}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {format(event.time, "HH:mm")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">by {event.user}</p>
              </div>
            </div>
          );
        })}
      </div>
    </RightDrawer>
  );
}
