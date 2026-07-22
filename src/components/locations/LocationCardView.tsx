import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Location } from "@/types/location";
import { LocationStatusBadge, SiteTypeBadge } from "./LocationStatusBadge";

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
                <SiteTypeBadge type={r.propertyType} />
              </div>

              <div className="mt-auto text-xs text-muted-foreground">{r.organizationName}</div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
