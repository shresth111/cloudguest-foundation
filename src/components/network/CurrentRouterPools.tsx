/**
 * "Current on router" -- the address pools each router is actually handing
 * out, read live off the device.
 *
 * The table below it lists only ranges created in Wyfy. Most routers' pool
 * was made by the setup script and exists on the device alone (prod,
 * 2026-10-24: 3 stored ranges for 17 routers), so before this the IP
 * Addresses page showed no current pool at all for most venues. Read-only:
 * editing a device-only pool is a separate decision from showing it.
 */
import { Radio, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouterLivePools } from "@/hooks/useDhcp";
import type { AppError } from "@/services/api";
import type { DhcpLivePool } from "@/types/dhcp";

export interface CurrentPoolRouter {
  id: string;
  name: string;
}

export function CurrentRouterPools({ routers }: { routers: readonly CurrentPoolRouter[] }) {
  if (routers.length === 0) return null;
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Radio className="h-4 w-4 text-primary" /> Current on router
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          The addresses your router is handing out right now, read directly from the device.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {routers.map((r) => (
          <RouterPools key={r.id} router={r} showName={routers.length > 1} />
        ))}
      </CardContent>
    </Card>
  );
}

function RouterPools({ router, showName }: { router: CurrentPoolRouter; showName: boolean }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useRouterLivePools(router.id);

  return (
    <div className="space-y-2">
      {showName && <div className="text-sm font-medium">{router.name}</div>}
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <span>
            Couldn&apos;t read the router right now
            {(error as unknown as AppError)?.message
              ? `: ${(error as unknown as AppError).message}`
              : "."}
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          This router has no address pool configured.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <PoolTile key={p.poolName} pool={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoolTile({ pool }: { pool: DhcpLivePool }) {
  const inUse = pool.server !== null && !pool.serverDisabled;
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{pool.poolName}</span>
        <Badge variant={inUse ? "default" : "secondary"} className="rounded-full">
          {inUse ? "Handing out addresses" : pool.server ? "DHCP server off" : "Not in use"}
        </Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Range</dt>
        <dd className="font-mono">{pool.ranges.join(", ") || "—"}</dd>
        <dt className="text-muted-foreground">Router address</dt>
        <dd className="font-mono">{pool.gateway ?? "—"}</dd>
        <dt className="text-muted-foreground">DNS</dt>
        <dd className="font-mono">{pool.dnsServers.join(", ") || "—"}</dd>
        <dt className="text-muted-foreground">Held for</dt>
        <dd>{pool.leaseTime ?? "—"}</dd>
        {pool.interface && (
          <>
            <dt className="text-muted-foreground">Network</dt>
            <dd className="font-mono">{pool.interface}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
