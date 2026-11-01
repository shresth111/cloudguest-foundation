/** Bulk CAF export (CAF-2): a ZIP of CAF PDFs for the subscribers on the
 * list, or for subscribers created in a date range (plain YYYY-MM-DD). The
 * API audits every export; subscribers without KYC are listed in the ZIP's
 * README instead. */
import { useState } from "react";
import { Archive, X } from "lucide-react";
import { MButton, MSeg } from "@/components/master/MasterKit";
import { Card, FormError, Spinner } from "@/components/isp-partner/kit";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { isoDay } from "@/lib/isp-partner/format";
import { exportBody } from "@/lib/isp-partner/caf";
import { cafService } from "@/services/isp-partner/caf";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

export function CafExportCard({
  picked,
  onRemove,
  max,
}: {
  picked: { id: string; label: string }[];
  onRemove: (id: string) => void;
  max: number;
}) {
  const [mode, setMode] = useState<"picked" | "range">("picked");
  const [since, setSince] = useState(isoDay(new Date(Date.now() - 30 * 86_400_000)));
  const [until, setUntil] = useState(isoDay(new Date()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card title="Export CAFs (ZIP)">
      <MSeg<"picked" | "range">
        value={mode}
        onChange={setMode}
        options={[
          { value: "picked", label: `From the list (${picked.length})` },
          { value: "range", label: "Created in a date range" },
        ]}
      />
      <div className="mt-3">
        {mode === "picked" ? (
          picked.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Use "Add to export list" on a subscriber above.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <li
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
                >
                  {p.label}
                  <button
                    type="button"
                    aria-label={`Remove ${p.label}`}
                    onClick={() => onRemove(p.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              aria-label="From"
              className={`${M_FILTER}`}
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
            <input
              type="date"
              aria-label="To"
              className={`${M_FILTER}`}
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
        )}
      </div>
      <MButton
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          setErr(null);
          const r = exportBody(
            mode,
            picked.map((p) => p.id),
            since,
            until,
            max,
          );
          if ("error" in r) return setErr(r.error);
          setBusy(true);
          try {
            const f = await cafService.exportZip(r.body);
            saveBlob(f.blob, f.filename);
          } catch (e) {
            setErr(ispErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : <Archive />} Download ZIP
      </MButton>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Up to {max} CAFs per file, within the zone you are viewing. Every export is recorded in the
        audit log.
      </p>
      <FormError message={err} />
    </Card>
  );
}
