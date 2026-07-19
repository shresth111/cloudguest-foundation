import { Link } from "@tanstack/react-router";
import { Activity, MapPin, Router, Users, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Location } from "@/types/location";
import { InternetStatusBadge, LocationStatusBadge, SiteTypeBadge } from "./LocationStatusBadge";

export function LocationCardView({ rows }: { rows: Location[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <Link
          key={r.id}
          to="/locations/$locationId"
          params={{ locationId: r.id }}
          className="group"
        >
          <Card className="h-full rounded-2xl border-border/70 shadow-sm transition-all group-hover:border-primary/50 group-hover:shadow-md">
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-foreground group-hover:text-primary">
                    {r.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">
                      {r.city}, {r.country}
                    </span>
                  </div>
                </div>
                <LocationStatusBadge status={r.status} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SiteTypeBadge type={r.siteType} />
                <InternetStatusBadge status={r.internetStatus} />
              </div>

              <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border/60 pt-4 text-center">
                <Stat icon={Router} value={r.routerCount} label="Routers" />
                <Stat icon={Users} value={r.activeGuests} label="Guests" />
                <Stat icon={Activity} value={r.todaysSessions} label="Sessions" />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="truncate">{r.organizationName}</div>
                <div className="flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  {r.internetSpeedMbps}Mbps
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Router; value: number; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
