/**
 * TR-069 tiles (ADDENDUM_05 J21): inventory counters for `/partner/tr069`,
 * and the optical RX power card for one device. Colour bands always carry a
 * text label, never colour alone.
 */
import { Cpu, Radio, Signal, Sparkles, Wrench } from "lucide-react";
import { MStat, MTag } from "@/components/master/MasterKit";
import { Card, Spinner } from "@/components/isp-partner/kit";
import { useTr069Optical, useTr069Summary } from "@/hooks/isp-partner/useNetwork";
import { isForbidden } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { OPTICAL_BAND_LABEL, opticalTone } from "@/lib/isp-partner/network";

export function Tr069SummaryTiles() {
  const q = useTr069Summary();
  if (q.error) {
    if (isForbidden(q.error)) return null;
    return (
      <p className="text-xs text-muted-foreground">
        Device counts are unavailable right now.{" "}
        <button type="button" className="text-primary hover:underline" onClick={() => q.refetch()}>
          Try again
        </button>
      </p>
    );
  }
  const s = q.data;
  const loading = q.isLoading;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MStat
        label="Devices"
        value={s?.total ?? 0}
        icon={Cpu}
        loading={loading}
        delta={s && s.unassigned > 0 ? `${s.unassigned} unassigned` : undefined}
      />
      <MStat
        label="Checking in"
        value={s?.active ?? 0}
        icon={Radio}
        tone="success"
        loading={loading}
        delta={s ? `${s.offline} not checking in` : undefined}
      />
      <MStat
        label="Configured today"
        value={s?.configured_today ?? 0}
        icon={Wrench}
        loading={loading}
      />
      <MStat label="New today" value={s?.new_today ?? 0} icon={Sparkles} loading={loading} />
    </div>
  );
}

export function Tr069OpticalCard({ cpeId }: { cpeId: string }) {
  const q = useTr069Optical(cpeId);
  return (
    <Card title="Optical signal (RX)">
      {q.isLoading ? (
        <Spinner />
      ) : q.error || !q.data ? (
        <p className="text-xs text-muted-foreground">
          {isForbidden(q.error)
            ? "Your role cannot read this."
            : "Couldn't read the optical power."}
        </p>
      ) : !q.data.available ? (
        <p className="text-sm text-muted-foreground">
          This device does not report optical power, or its parameters have not been read yet.
        </p>
      ) : (
        <div className="space-y-1">
          <p className="flex items-center gap-2">
            <Signal className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-semibold tabular-nums">{q.data.dbm} dBm</span>
            {q.data.band && (
              <MTag label={OPTICAL_BAND_LABEL[q.data.band]} tone={opticalTone(q.data.band)} />
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Good is −8 to −25 dBm. Read {formatDateTime(q.data.params_refreshed_at)}. Raw value{" "}
            <span className="font-mono">{String(q.data.raw)}</span>.
          </p>
        </div>
      )}
    </Card>
  );
}
