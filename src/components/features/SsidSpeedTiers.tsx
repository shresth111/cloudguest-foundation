/**
 * Access Rules -> "Speed tiers by WiFi network", shown only at an Aruba
 * Instant On (NAS-only) venue. Lists the venue's guest WiFi networks, the tier
 * each stands for, its speed, and who may join it, and saves the mapping. The
 * customer sees whether each network's speed is live (backend #510
 * `speed_status`) and, when cloud control is on for the venue and they hold
 * `bandwidth.update`, an Apply speeds button. Never "go and type them into
 * another app" (owner rule 2026-11-07), and no promise that a person will
 * apply them: until cloud control is on they are saved here only. In the Master
 * console (a global session) it also lists the backend's manual steps and
 * previews / pushes the speeds through Instant On cloud control, which is OFF
 * unless ops switched it on for the venue.
 *
 * Copy is held to what is true: one speed per network for every guest on it
 * (`ONE_SPEED_PER_NETWORK`), never a per-guest speed.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Gauge, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMyPermissions } from "@/hooks/useCustomerDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SsidTierGuests } from "./SsidTierGuests";
import { crossOrganizationHeaders } from "@/services/api";
import { ssidTiersService, type InstantOnSyncResult } from "@/services/ssid-tiers.service";
import {
  MAX_SSID_TIERS,
  ONE_SPEED_PER_NETWORK,
  PAID_ROW_HINT,
  SSID_TIERS_INTRO,
  SSID_TIERS_TITLE,
  SPEEDS_SAVED_HERE_ONLY,
  canApplySsidSpeeds,
  emptySsidTier,
  formatTierSpeed,
  ssidSpeedReasonCopy,
  ssidSpeedReasonKey,
  ssidTiersProblem,
  type SsidSpeedStatus,
  type SsidTier,
  type SsidTiersView,
} from "@/lib/ssid-tiers";

function mbps(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

export default function SsidSpeedTiers({ locationId }: { locationId: string }) {
  const { t } = useTranslation("accessRules", { i18n });
  const qc = useQueryClient();
  const isPlatform = crossOrganizationHeaders() !== undefined;
  const queryKey = ["ssid-tiers", locationId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => ssidTiersService.list(locationId),
    enabled: !!locationId,
  });

  const [draft, setDraft] = useState<SsidTier[]>([]);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sync, setSync] = useState<InstantOnSyncResult | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const { data: permissions } = useMyPermissions();

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
        t(
          "ssidTiers.saved",
          "Saved. Wyfy now checks who may join each network when a guest signs in. Each network's speed is applied once cloud control is on for this venue; until then it is saved here only.",
        ),
      );
    },
    onError: (e: unknown) =>
      setMessage(e instanceof Error ? e.message : t("ssidTiers.saveFailed", "Couldn't save.")),
  });

  // Customer apply (backend #510). The answer is a speed status: it replaces
  // the one on the cached view, and the view is re-read after.
  const applySpeeds = useMutation({
    mutationFn: () => ssidTiersService.applySpeeds(locationId, false),
    onSuccess: (result) => {
      setConfirmApply(false);
      if (result) {
        qc.setQueryData<SsidTiersView>(queryKey, (prev) =>
          prev ? { ...prev, speedStatus: result } : prev,
        );
      }
      void qc.invalidateQueries({ queryKey });
      if (result?.status === "applied") {
        toast.success(t("ssidTiers.speed.appliedToast", "Speeds applied to every mapped network."));
      } else {
        toast.warning(t("ssidTiers.speed.pendingToast", "Not every speed was applied."), {
          description: t(ssidSpeedReasonKey(result?.reason ?? null), {
            defaultValue: ssidSpeedReasonCopy(result?.reason ?? null),
          }),
        });
      }
    },
    onError: () => {
      setConfirmApply(false);
      toast.error(
        t(
          "ssidTiers.speed.noAnswerToast",
          "We didn't get an answer, so we don't know whether the speeds changed. Reload this page to see what's set now.",
        ),
      );
    },
  });
  const speed: SsidSpeedStatus | null = data?.speedStatus ?? null;
  const showApply =
    !!speed && speed.cloudApplyAvailable && !dirty && canApplySsidSpeeds(permissions);

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
            <h2 className="text-base font-semibold">{t("ssidTiers.title", SSID_TIERS_TITLE)}</h2>
            <p className="text-sm text-muted-foreground">
              {t("ssidTiers.intro", SSID_TIERS_INTRO)}
            </p>
            <p className="mt-1 text-sm font-medium" data-testid="ssid-tiers-one-speed">
              {t("ssidTiers.oneSpeed", ONE_SPEED_PER_NETWORK)}
            </p>
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">{t("ssidTiers.loading", "Loading…")}</p>
        )}
        {isError && (
          <p className="text-sm text-destructive">
            {t("ssidTiers.loadFailed", "Couldn't load the WiFi networks for this location.")}
          </p>
        )}

        {!isLoading && !isError && (
          <div className="space-y-3">
            {draft.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="ssid-tiers-empty">
                {t(
                  "ssidTiers.empty",
                  "No networks mapped. Every guest on every WiFi network is treated the same.",
                )}
              </p>
            )}
            {draft.map((row, i) => (
              <div key={i} className="space-y-3 rounded-lg border p-3" data-testid="ssid-tier-row">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">
                      {t("ssidTiers.ssidLabel", "WiFi network name (SSID)")}
                    </span>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={row.ssid}
                      maxLength={32}
                      placeholder="WYFY_PREMIUM"
                      aria-label={t("ssidTiers.ssidAria", "WiFi network name")}
                      onChange={(e) => update(i, { ssid: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">{t("ssidTiers.tierLabel", "Tier")}</span>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={row.tierName}
                      maxLength={100}
                      placeholder={t("ssidTiers.tierPlaceholder", "Premium")}
                      aria-label={t("ssidTiers.tierAria", "Tier name")}
                      onChange={(e) => update(i, { tierName: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">
                      {t("ssidTiers.downloadLabel", "Download speed per guest (Mbps)")}
                    </span>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      inputMode="numeric"
                      value={Number.isFinite(row.downloadMbps) ? (row.downloadMbps as number) : ""}
                      placeholder={t("ssidTiers.noCap", "No cap")}
                      aria-label={t("ssidTiers.downloadAria", "Download Mbps")}
                      onChange={(e) => update(i, { downloadMbps: mbps(e.target.value) })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">
                      {t("ssidTiers.uploadLabel", "Upload speed per guest (Mbps)")}
                    </span>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      inputMode="numeric"
                      value={Number.isFinite(row.uploadMbps) ? (row.uploadMbps as number) : ""}
                      placeholder={t("ssidTiers.noCap", "No cap")}
                      aria-label={t("ssidTiers.uploadAria", "Upload Mbps")}
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
                      aria-label={t("ssidTiers.paidOnly", "Paid / voucher guests only")}
                    />
                    {t("ssidTiers.paidOnly", "Paid / voucher guests only")}
                  </label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm text-destructive"
                    onClick={() => {
                      setDraft((rows) => rows.filter((_, j) => j !== i));
                      setDirty(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> {t("ssidTiers.remove", "Remove")}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.paidOnly
                    ? t("ssidTiers.paidHint", PAID_ROW_HINT)
                    : t("ssidTiers.openToAll", "Open to every guest who signs in.")}{" "}
                  {t(
                    "ssidTiers.rowSpeed",
                    "Speed: {{speed}}, the same for every guest on “{{ssid}}”.",
                    {
                      speed: formatTierSpeed(
                        Number.isFinite(row.downloadMbps) ? row.downloadMbps : null,
                        Number.isFinite(row.uploadMbps) ? row.uploadMbps : null,
                      ),
                      ssid: row.ssid || t("ssidTiers.thisNetwork", "this network"),
                    },
                  )}
                </p>
                {/* Only once saved and unedited: the list hangs off the saved row. */}
                {row.paidOnly && !dirty && data?.items.some((x) => x.ssid === row.ssid) && (
                  <SsidTierGuests locationId={locationId} row={row} rows={data.items} />
                )}
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
                <Plus className="h-4 w-4" /> {t("ssidTiers.addNetwork", "Add WiFi network")}
              </button>
              <button
                type="button"
                disabled={!dirty || !!problem || save.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-[#4f46e5] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => save.mutate()}
              >
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
                {t("ssidTiers.save", "Save")}
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

            {/* Customer: whether each network's speed is live, from the
                backend's neutral `speed_status`. Never tells the owner to type
                speeds into another app (owner rule 2026-11-07), and never
                promises a person will apply them. A missing status reads as
                "not available": no button, the saved-here-only sentence. */}
            {!isPlatform && data && data.items.length > 0 && speed?.status !== "not_applicable" && (
              <div
                className="space-y-2 rounded-lg bg-muted/50 p-3"
                data-testid="ssid-tiers-speeds-note"
              >
                <p className="text-sm font-medium">
                  {t("ssidTiers.speedsAppliedTitle", "Network speeds")}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="ssid-tiers-speed-summary">
                  {!speed
                    ? t("ssidTiers.speedsAppliedBody", SPEEDS_SAVED_HERE_ONLY)
                    : speed.status === "applied"
                      ? t(
                          "ssidTiers.speed.allApplied",
                          "Every mapped network's speed is applied on the access points.",
                        )
                      : t(ssidSpeedReasonKey(speed.reason), {
                          defaultValue: ssidSpeedReasonCopy(speed.reason),
                        })}
                </p>
                {speed && speed.items.length > 0 && (
                  <ul className="space-y-0.5 text-xs" data-testid="ssid-tiers-speed-items">
                    {speed.items.map((it) => (
                      <li key={it.ssid} data-testid="ssid-tiers-speed-item">
                        {it.status === "applied"
                          ? t("ssidTiers.speed.itemApplied", "“{{ssid}}”: {{speed}}, applied", {
                              ssid: it.ssid,
                              speed: formatTierSpeed(it.downloadMbps, it.uploadMbps),
                            })
                          : t(
                              "ssidTiers.speed.itemPending",
                              "“{{ssid}}”: {{speed}}, not applied yet",
                              {
                                ssid: it.ssid,
                                speed: formatTierSpeed(it.downloadMbps, it.uploadMbps),
                              },
                            )}
                        {it.status !== "applied" && it.reason && (
                          <span className="text-muted-foreground">
                            {" "}
                            {t(ssidSpeedReasonKey(it.reason), {
                              defaultValue: ssidSpeedReasonCopy(it.reason),
                            })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {showApply &&
                  (confirmApply ? (
                    <div
                      className="flex flex-wrap items-center gap-2"
                      data-testid="ssid-tiers-apply-confirm"
                    >
                      <span className="text-xs">
                        {t(
                          "ssidTiers.speed.confirm",
                          "Apply these speeds to the guest WiFi now? Guests on each network get its new speed.",
                        )}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md bg-[#4f46e5] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        disabled={applySpeeds.isPending}
                        onClick={() => applySpeeds.mutate()}
                      >
                        {applySpeeds.isPending && <Loader2 className="h-3 w-3 animate-spin" />}{" "}
                        {t("ssidTiers.speed.confirmApply", "Apply now")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border px-3 py-1.5 text-xs"
                        disabled={applySpeeds.isPending}
                        onClick={() => setConfirmApply(false)}
                      >
                        {t("ssidTiers.speed.cancel", "Cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md border px-3 py-1.5 text-xs font-medium"
                      data-testid="ssid-tiers-apply"
                      onClick={() => setConfirmApply(true)}
                    >
                      {t("ssidTiers.speed.apply", "Apply speeds")}
                    </button>
                  ))}
              </div>
            )}

            {isPlatform && data && data.manualSteps.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3" data-testid="ssid-tiers-manual">
                <p className="text-sm font-medium">Manual speed steps (Master)</p>
                <p className="text-xs text-muted-foreground">
                  The speed is held on the access points, one per network. Use the same names as
                  above — a different spelling is a different network.
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
