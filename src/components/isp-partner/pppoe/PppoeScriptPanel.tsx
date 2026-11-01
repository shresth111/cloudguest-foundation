/**
 * "Turn on the PPPoE server" for one router (Phase 2b, lane JAZE-6): a
 * separate RouterOS step for a router that already ran the main setup
 * script. Fetched on demand: the script carries the router's RADIUS secret,
 * every fetch is audited, and it is never cached. Owner, admin and
 * technician only (same rule as the main setup script).
 */
import { useState } from "react";
import { Download, FileCode2 } from "lucide-react";
import { MButton } from "@/components/master/MasterKit";
import {
  Card,
  CopyField,
  ErrorBlock,
  FormError,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { usePppoeRouterScript } from "@/hooks/isp-partner/usePppoe";
import { saveBlob } from "@/lib/isp-partner/download";
import { canGetPppoeScript, scriptParams } from "@/lib/isp-partner/pppoe";
import { rscSlug } from "@/lib/rsc-filename";
import type { PppoeScriptParams, PppoeStatus } from "@/services/isp-partner/pppoe-types";

const EMPTY: Required<PppoeScriptParams> = {
  interface: "",
  local_address: "",
  pool_range: "",
  pool_cidr: "",
  dns_servers: "",
};

export function PppoeScriptPanel({
  routerId,
  routerName,
  defaults,
}: {
  routerId: string;
  routerName: string;
  defaults: PppoeStatus["defaults"];
}) {
  const { me } = usePartner();
  const [form, setForm] = useState(EMPTY);
  const [params, setParams] = useState<PppoeScriptParams | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const q = usePppoeRouterScript(routerId, params);
  const set = (k: keyof PppoeScriptParams) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setParams(null);
  };

  if (!canGetPppoeScript(me.user.role)) {
    return (
      <Card title="PPPoE server setup">
        <p className="text-xs text-muted-foreground">
          Only an owner, admin or technician can generate router scripts.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="PPPoE server setup"
      actions={
        q.data && (
          <MButton
            variant="outline"
            onClick={() =>
              saveBlob(
                new Blob([q.data], { type: "text/plain;charset=utf-8" }),
                `pppoe-${rscSlug(routerName) || routerId.slice(0, 8)}.rsc`,
              )
            }
          >
            <Download /> Download .rsc
          </MButton>
        )
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        For a router that already ran its main setup script. It adds a PPPoE server on the chosen
        interface, an address pool, and points PPPoE sign-ins and accounting at Wyfy Guest, so each
        subscriber&apos;s username, speed and validity come from their package here. Leave a field
        blank to use the default shown. Safe to paste twice.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Interface"
          value={form.interface}
          onChange={set("interface")}
          placeholder={defaults.interface}
          hint="Where subscribers' routers connect, e.g. a bridge or VLAN."
        />
        <TextField
          label="Local address (router side)"
          value={form.local_address}
          onChange={set("local_address")}
          placeholder={defaults.local_address}
        />
        <TextField
          label="Pool network"
          value={form.pool_cidr}
          onChange={set("pool_cidr")}
          placeholder={defaults.pool_cidr}
        />
        <TextField
          label="Pool range"
          value={form.pool_range}
          onChange={set("pool_range")}
          placeholder={defaults.pool_range}
        />
        <TextField
          label="DNS servers (optional)"
          value={form.dns_servers}
          onChange={set("dns_servers")}
          placeholder="Comma separated; blank = the local address"
        />
      </div>
      <FormError message={err} />
      <div className="mt-3">
        <MButton
          variant="outline"
          disabled={q.isFetching}
          onClick={() => {
            setErr(null);
            const r = scriptParams(form, defaults);
            if ("error" in r) return setErr(r.error);
            setParams(r.params);
          }}
        >
          {q.isFetching ? <Spinner /> : <FileCode2 />} Generate PPPoE script
        </MButton>
      </div>
      {params && !q.isFetching && (
        <div className="mt-3">
          {q.error ? (
            <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the PPPoE script" />
          ) : q.data ? (
            <div className="space-y-2">
              <CopyField label="Script (contains a secret, do not share)" value={q.data} />
              <pre className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-2.5 text-[11px] leading-snug">
                <code>{q.data}</code>
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
