import { Link } from "@tanstack/react-router";
import { MapPin, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Location } from "@/types/location";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<Location["status"], string> = {
  active: "bg-emerald-500",
  inactive: "bg-zinc-400",
  suspended: "bg-fuchsia-500",
  archived: "bg-rose-500",
};

export function LocationMapView({ rows }: { rows: Location[] }) {
  // Project lat/lng into the plotted rectangle. Simple equirectangular mock.
  const project = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { left: `${Math.max(2, Math.min(98, x))}%`, top: `${Math.max(4, Math.min(96, y))}%` };
  };

  const groups = new Map<string, Location[]>();
  rows.forEach((r) => {
    const key = `${r.country}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="relative overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <div
          className="relative h-[520px] w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.08), transparent 40%), radial-gradient(circle at 80% 70%, hsl(var(--primary) / 0.06), transparent 45%), linear-gradient(180deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))",
          }}
        >
          {/* grid overlay */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {rows.filter((r) => r.latitude != null && r.longitude != null).map((r) => {
            const pos = project(r.latitude as number, r.longitude as number);
            return (
              <Link
                key={r.id}
                to="/locations/$locationId"
                params={{ locationId: r.id }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={pos}
                title={`${r.name} — ${r.city}`}
              >
                <div className="group relative">
                  <div className={cn("h-3 w-3 rounded-full ring-2 ring-background", STATUS_DOT[r.status])}>
                    <div className={cn("absolute inset-0 animate-ping rounded-full opacity-60", STATUS_DOT[r.status])} />
                  </div>
                  <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md group-hover:block">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-muted-foreground">
                      {r.city}, {r.country}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          <div className="absolute bottom-3 left-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-xs backdrop-blur">
            <div className="mb-1 flex items-center gap-1 font-medium">
              <Navigation className="h-3 w-3" /> Map preview
            </div>
            <div className="text-muted-foreground">Interactive geospatial view coming soon</div>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Coverage by country</h3>
        </div>
        <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
          {Array.from(groups.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .map(([country, list]) => {
              const online = list.filter((l) => l.status === "active").length;
              return (
                <div
                  key={country}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{country}</div>
                    <div className="text-xs text-muted-foreground">
                      {online} active · {list.length} total
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{list.length}</div>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}
