import { useMemo, useState } from "react";
import { LifeBuoy, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CopyBlock } from "./CopyBlock";
import type { Symptom } from "./types";

const SURFACES = [
  { key: "all", label: "Sab" },
  { key: "router", label: "Router" },
  { key: "portal", label: "Portal" },
  { key: "phone", label: "Phone" },
  { key: "dashboard", label: "Dashboard" },
] as const;

type SurfaceKey = (typeof SURFACES)[number]["key"];

/**
 * "Aisa dikh raha hai -- iska matlab kya hai" lookup.
 *
 * Opened from a failed check (seeded with that check's own wording, so
 * the first thing he sees is usually already the right entry) or from the
 * always-available button at the bottom of every phase.
 *
 * `Symptom` carries no phase id, so "filtered to this phase" is done by
 * seeding the free-text search rather than by a hard filter -- a hard
 * filter on a field that does not exist would either show nothing or
 * silently show everything. Seeding keeps every entry reachable, which
 * matters because the symptom he is actually looking at is quite often
 * caused by a phase he finished ten minutes ago.
 */
export function DiagnosticsLookup({
  symptoms,
  seed,
  onClose,
}: {
  symptoms: Symptom[];
  seed?: string;
  onClose: () => void;
}) {
  const [q, setQ] = useState(seed ?? "");
  const [surface, setSurface] = useState<SurfaceKey>("all");

  const results = useMemo(() => {
    const terms = q
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length > 2);
    return symptoms
      .filter((s) => surface === "all" || s.surface === surface)
      .map((s) => {
        const hay = [s.seen, s.probe, ...s.causes.flatMap((c) => [c.tell, c.cause, c.note])]
          .join(" ")
          .toLowerCase();
        // Rank by how many of the seeded words appear, so an unseeded open
        // (score 0 everywhere) keeps the content author's own ordering.
        const score = terms.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
        return { s, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((r) => r.s);
  }, [symptoms, q, surface]);

  return (
    <div className="rounded-xl border border-primary/40 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <LifeBuoy className="h-4 w-4 text-primary" /> Kya dikh raha hai?
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Band karo
        </button>
      </div>

      <div className="space-y-2.5 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jo screen pe dikha, wahi likho -- jaise 'spinner atka' ya 'certificate warning'"
            className="pl-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SURFACES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSurface(s.key)}
              className={cn(
                "min-h-8 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                surface === s.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {symptoms.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Diagnostics list abhi khaali hai.
          </p>
        ) : results.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Is filter me kuch nahi mila -- "Sab" pe click karke dobara dekho.
          </p>
        ) : (
          <div className="space-y-2">
            {results.map((s) => (
              <SymptomCard key={s.id} symptom={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SymptomCard({ symptom }: { symptom: Symptom }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent/50"
      >
        <span className="text-xs font-medium text-foreground">{symptom.seen}</span>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {symptom.surface}
        </span>
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-border px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sabse pehle yeh dekho
            </p>
            <p className="mt-0.5 text-xs text-foreground">{symptom.probe}</p>
          </div>
          {symptom.causes.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-2.5">
              <p className="text-xs font-medium text-foreground">
                <span className="text-primary">Agar:</span> {c.tell}
              </p>
              <p className="mt-1 text-xs text-foreground">
                <span className="text-muted-foreground">Wajah:</span> {c.cause}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{c.note}</p>
              {c.fix && (
                <div className="mt-2">
                  <CopyBlock label="Fix" script={c.fix} index={0} total={1} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
