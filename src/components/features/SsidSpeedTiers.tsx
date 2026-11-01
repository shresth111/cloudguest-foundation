/**
 * Access Rules -> "Speed tiers by WiFi network", shown only at an Aruba
 * Instant On (NAS-only) venue. Lists the venue's guest WiFi networks, the tier
 * each stands for, its speed, and who may join it; saves the mapping; and says
 * exactly what to set in Instant On by hand. In the Master console (a global
 * session) it also previews / pushes the speeds through Instant On cloud
 * control, which is OFF unless ops switched it on for the venue.
 *
 * Copy is held to what is true: one speed per network for every guest on it
 * (`ONE_SPEED_PER_NETWORK`), never a per-guest speed.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { bandwidthPolicyService } from "@/services/bandwidth-policy.service";
import { resolveOrgId } from "@/services/customer.service";
import { crossOrganizationHeaders } from "@/services/api";
import { ssidTiersService, type InstantOnSyncResult } from "@/services/ssid-tiers.service";
import {
  MAX_SSID_TIERS,
  ONE_SPEED_PER_NETWORK,
  PAID_ROW_HINT,
  SSID_TIERS_INTRO,
  SSID_TIERS_TITLE,
  emptySsidTier,
  formatTierSpeed,
  ssidTiersProblem,
  type SsidTier,
} from "@/lib/ssid-tiers";

function mbps(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

export default function SsidSpeedTiers({ locationId }: { locationId: string }) {
  const qc = useQueryClient();
  const isPlatform = crossOrganizationHeaders() !== undefined;
  const queryKey = ["ssid-tiers", locationId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => ssidTiersService.list(locationId),
    enabled: !!locationId,
  });
  const { data: accessTiers = [] } = useQuery({
    queryKey: ["ssid-tiers-access-tiers"],
    queryFn: async () => {
      const org = await resolveOrgId();
      const all = await bandwidthPolicyService.list(org);
      return all.filter((p) => p.status !== "archived").map((p) => ({ id: p.id, name: p.name }));
    },
  });

  const [draft, setDraft] = useState<SsidTier[]>([]);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sync, setSync] = useState<InstantOnSyncResult | null>(null);

  useEffect(() => {
    if (data && !dirty) setDraft(data.items);
  }, [data, dirty]);

  const problem = useMemo(() => ssidTiersProblem(draft), [draft]);

  const save = useMutation({
    mutationFn: () => ssidTiersService.replace(locationId, draft),
    onSuccess: (view) => {
      qc.setQueryData(queryKey, view);
      setDirty(false);
      setMessage(
        "Saved. Wyfy now checks who may join each network when a guest signs in. " +
          "Set each network's speed in Instant On (below) — Wyfy doesn't change it there for you.",
      );
    },
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : "Couldn't save."),
  });

  const push = useMutation({
    mutationFn: (dryRun: boolean) => ssidTiersService.syncToInstantOn(locationId, dryRun),
    onSuccess: (result) => setSync(result),
    onError: (e: unknown) => setMessage(e instanceof Error ? e.message : "Instant On sync failed."),
  });

  const update = (i: number, patch: Partial<SsidTier>) => {
    setDraft((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
    setMessage(null);
  };

  return (
    <Card data-testid="ssid-speed-tiers">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4f46e5]/10">
            <Gauge className="h-4 w-4 text-[#4f46e5]" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{SSID_TIERS_TITLE}</h2>
            <p className="text-sm text-muted-foreground">{SSID_TIERS_INTRO}</p>
            <p className="mt-1 text-sm font-medium" data-testid="ssid-tiers-one-speed">
              {ONE_SPEED_PER_NETWORK}
            </p>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {isError && (
          <p className="text-sm text-destructive">
            Couldn't load the WiFi networks for this location.
          </p>
        )}

        {!isLoading && !isError && (
          <div className="space-y-3">
            {draft.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="ssid-tiers-empty">
                No networks mapped. Every guest on every WiFi network is treated the same.
              </p>
            )}
            {draft.map((row, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-3" data-testid="ssid-tier-row">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">WiFi network name (SSID)</span>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={row.ssid}
                      maxLength={32}
                      placeholder="WYFY_PREMIUM"
                      aria-label="WiFi network name"
                      onChange={(e) => update(i, { ssid: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Tier</span>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={row.tierName}
                      maxLength={100}
                      placeholder="Premium"
                      aria-label="Tier name"
                      onChange={(e) => update(i, { tierName: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Download speed per guest (Mbps)</span>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      inputMode="numeric"
                      value={Number.isFinite(row.downloadMbps) ? (row.downloadMbps as number) : ""}
                      placeholder="No cap"
                      aria-label="Download Mbps"
                      onChange={(e) => update(i, { downloadMbps: mbps(e.target.value) })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Upload speed per guest (Mbps)</span>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      inputMode="numeric"
                      value={Number.isFinite(row.uploadMbps) ? (row.uploadMbps as number) : ""}
                      placeholder="No cap"
                      aria-label="Upload Mbps"
                      onChange={(e) => update(i, { uploadMbps: mbps(e.target.value) })}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={row.paidOnly}
                      onCheckedChange={(v) =>
                        update(i, v ? { paidOnly: true } : { paidOnly: false, policyId: null })
                      }
                      aria-label="Paid / voucher guests only"
                    />
                    Paid / voucher guests only
                  </label>
                  {row.paidOnly && (
                    <label className="flex items-center gap-2 text-sm">
                      <span>Also open to Access Tier</span>
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={row.policyId ?? ""}
                        aria-label="Access Tier"
                        onChange={(e) => update(i, { policyId: e.target.value || null })}
                      >
                        <option value="">None (vouchers only)</option>
                        {accessTiers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm text-destructive"
                    onClick={() => {
                      setDraft((rows) => rows.filter((_, j) => j !== i));
                      setDirty(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.paidOnly ? PAID_ROW_HINT : "Open to every guest who signs in."} Speed:{" "}
                  {formatTierSpeed(
                    Number.isFinite(row.downloadMbps) ? row.downloadMbps : null,
                    Number.isFinite(row.uploadMbps) ? row.uploadMbps : null,
                  )}
                  , the same for every guest on “{row.ssid || "this network"}”.
                </p>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={draft.length >= MAX_SSID_TIERS}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => {
                  setDraft((rows) => [...rows, emptySsidTier()]);
                  setDirty(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add WiFi network
              </button>
              <button
                type="button"
                disabled={!dirty || !!problem || save.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => save.mutate()}
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
              {dirty && problem && (
                <span className="text-sm text-destructive" data-testid="ssid-tiers-problem">
                  {problem}
                </span>
              )}
            </div>
            {message && (
              <p className="text-sm" role="status">
                {message}
              </p>
            )}

            {data && data.manualSteps.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3" data-testid="ssid-tiers-manual">
                <p className="text-sm font-medium">Set these speeds in the Instant On app</p>
                <p className="text-xs text-muted-foreground">
                  The speed lives in Instant On, one per network. Use the same names as above — a
                  different spelling is a different network.
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {data.manualSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {isPlatform && data && data.items.length > 0 && (
              <div
                className="space-y-2 rounded-lg border border-dashed p-3"
                data-testid="ssid-tiers-push"
              >
                <p className="text-sm font-medium">Instant On cloud control (Master)</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm"
                    disabled={push.isPending}
                    onClick={() => push.mutate(true)}
                  >
                    Preview speeds in Instant On
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-2 text-sm"
                    disabled={push.isPending || !data.pushEnabled}
                    title={data.pushEnabled ? undefined : "Switched off for this platform"}
                    onClick={() => push.mutate(false)}
                  >
                    Apply speeds in Instant On
                  </button>
                </div>
                {sync && (
                  <div className="text-sm" data-testid="ssid-tiers-sync-result">
                    <p>
                      {sync.status === "manual"
                        ? `Not sent to Instant On (${sync.reason}). Set the speeds by hand as listed above.`
                        : `Instant On: ${sync.status}.`}
                    </p>
                    <ul className="list-disc pl-5">
                      {sync.items.map((it) => (
                        <li key={it.ssid}>
                          {it.ssid}: {it.status}
                          {it.message ? ` — ${it.message}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
