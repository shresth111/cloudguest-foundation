import { Link } from "@tanstack/react-router";
import { Building2, MapPin, Router as RouterIcon, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceScope } from "@/hooks/useWorkspace";

export function LocationGrid() {
  const { setActiveLocationId } = useWorkspace();
  const { scope } = useWorkspaceScope();

  if (scope.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No locations under the current scope. Switch to “All locations” to see everything.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {scope.map((l) => {
        const rOnline = l.resources?.routers.filter((r) => r.status === "online").length ?? 0;
        const rTotal = l.resources?.routers.length ?? 0;
        return (
          <Card key={l.id} className="transition-shadow hover:shadow-md">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.city} · <span className="capitalize">{l.siteType}</span>
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {l.siteType}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-xs text-muted-foreground">Guests</p>
                  <p className="text-sm font-semibold">
                    {l.resources?.analytics.activeSessions ?? "—"}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-xs text-muted-foreground">Routers</p>
                  <p className="text-sm font-semibold">
                    {rOnline}/{rTotal}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm font-semibold">
                    {l.resources?.analytics.dataConsumedGb.toFixed(1) ?? "—"} GB
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setActiveLocationId(l.id)}>
                  Focus location
                </Button>
                <Button asChild size="sm">
                  <Link to="/workspace/locations/$locationId" params={{ locationId: l.id }}>
                    Open workspace
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function LocationTree() {
  const { locations, activeLocationId, setActiveLocationId } = useWorkspace();
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 border-b pb-2 text-sm font-medium">
          <Building2 className="h-4 w-4 text-primary" /> Customer
        </div>
        <ul className="mt-2 space-y-1 pl-4">
          <li>
            <button
              onClick={() => setActiveLocationId("all")}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted ${
                activeLocationId === "all" ? "bg-muted font-medium" : ""
              }`}
            >
              <MapPin className="h-4 w-4" /> All locations ({locations.length})
            </button>
          </li>
          {locations.map((l) => (
            <li key={l.id} className="pl-4">
              <button
                onClick={() => setActiveLocationId(l.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted ${
                  activeLocationId === l.id ? "bg-muted font-medium" : ""
                }`}
              >
                <MapPin className="h-4 w-4 opacity-70" /> {l.name}
              </button>
              <ul className="ml-6 mt-1 space-y-0.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <RouterIcon className="h-3 w-3" /> Routers
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-3 w-3" /> Guests
                </li>
              </ul>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
