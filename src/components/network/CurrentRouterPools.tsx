/**
 * "Current on router" -- the address pools each router is actually handing
 * out, read live off the device.
 *
 * The table below it lists only ranges created in Wyfy. Most routers' pool
 * was made by the setup script and exists on the device alone (prod,
 * 2026-10-24: 3 stored ranges for 17 routers), so before this the IP
 * Addresses page showed no current pool at all for most venues. Each pool
 * can be edited in place (range, DNS, how long an address is held); the
 * router's own address is shown but never edited here -- changing it would
 * move the router and the hotspot behind it.
 */
import { useState } from "react";
import { Pencil, Radio, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouterLivePools, useUpdateRouterLivePool } from "@/hooks/useDhcp";
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
            <PoolTile key={p.poolName} pool={p} routerId={router.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function PoolTile({ pool, routerId }: { pool: DhcpLivePool; routerId: string }) {
  const [editing, setEditing] = useState(false);
  const inUse = pool.server !== null && !pool.serverDisabled;
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{pool.poolName}</span>
        <div className="flex items-center gap-2">
          <Badge variant={inUse ? "default" : "secondary"} className="rounded-full">
            {inUse ? "Handing out addresses" : pool.server ? "DHCP server off" : "Not in use"}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </div>
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
      {editing && (
        <EditPoolDialog pool={pool} routerId={routerId} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

/** RouterOS durations ("30m", "1d", "1h30m", "00:30:00") -> seconds, or
 * undefined when it can't be read. */
function routerOsDurationSeconds(value: string | null): number | undefined {
  if (!value) return undefined;
  const clock = /^(\d+):(\d{2}):(\d{2})$/.exec(value);
  if (clock) return +clock[1] * 3600 + +clock[2] * 60 + +clock[3];
  const units: Record<string, number> = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
  let total = 0;
  const re = /(\d+)([wdhms])/g;
  let matched = "";
  for (let m = re.exec(value); m; m = re.exec(value)) {
    total += +m[1] * units[m[2]];
    matched += m[0];
  }
  return matched === value && total > 0 ? total : undefined;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function EditPoolDialog({
  pool,
  routerId,
  onClose,
}: {
  pool: DhcpLivePool;
  routerId: string;
  onClose: () => void;
}) {
  const [first] = pool.ranges;
  const [start0, end0] = (first ?? "").split("-");
  const leaseSeconds = routerOsDurationSeconds(pool.leaseTime);
  const [rangeStart, setRangeStart] = useState(start0 ?? "");
  const [rangeEnd, setRangeEnd] = useState(end0 ?? start0 ?? "");
  const [dns, setDns] = useState(pool.dnsServers.join(", "));
  const [leaseMinutes, setLeaseMinutes] = useState(
    leaseSeconds ? String(Math.round(leaseSeconds / 60)) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateRouterLivePool(routerId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const dnsList = dns
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    if (!IPV4.test(rangeStart.trim()) || !IPV4.test(rangeEnd.trim())) {
      setError("Enter the range as two addresses, like 10.5.50.10 and 10.5.50.254.");
      return;
    }
    if (dnsList.some((d) => !IPV4.test(d))) {
      setError("DNS has to be addresses, like 8.8.8.8, separated by commas.");
      return;
    }
    const minutes = leaseMinutes.trim() ? Number(leaseMinutes) : undefined;
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080)) {
      setError("Held for has to be between 1 minute and 7 days (10080 minutes).");
      return;
    }
    setError(null);
    update.mutate(
      {
        poolName: pool.poolName,
        rangeStart: rangeStart.trim(),
        rangeEnd: rangeEnd.trim(),
        leaseTimeSeconds: minutes !== undefined ? minutes * 60 : undefined,
        dnsServers: dnsList.length ? dnsList : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${pool.poolName} updated on the router`);
          onClose();
        },
        onError: (err) =>
          setError(
            (err as unknown as AppError)?.message ||
              `Couldn't update ${pool.poolName} on the router`,
          ),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {pool.poolName}</DialogTitle>
          <DialogDescription>
            Changes are made on the router straight away. Devices already connected keep their
            address until it next renews.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Range start</Label>
            <Input
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Range end</Label>
            <Input
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Router address</Label>
            <Input value={pool.gateway ?? "—"} disabled className="font-mono" />
            <p className="text-[11px] text-muted-foreground">
              Fixed{pool.network ? `; the range has to stay inside ${pool.network}` : ""}.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Held for (minutes)</Label>
            <Input
              value={leaseMinutes}
              onChange={(e) => setLeaseMinutes(e.target.value)}
              inputMode="numeric"
              placeholder={pool.leaseTime ?? "30"}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium">DNS</Label>
            <Input
              value={dns}
              onChange={(e) => setDns(e.target.value)}
              placeholder="8.8.8.8, 1.1.1.1"
              className="font-mono"
            />
          </div>
          {pool.ranges.length > 1 && (
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              This pool has {pool.ranges.length} ranges on the router; saving replaces them with the
              one above.
            </p>
          )}
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save to router"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
