/** Non-component helpers of `ui.tsx` (hooks, maps, formatters), split out so
 * that file only exports components (react-refresh/only-export-components). */
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { formatRelative } from "@/lib/format";
import type { OverviewStatus } from "@/components/customer/dashboard/overview/console-ui";
import type { FleetBucket, FleetKind } from "./fleet-model";

/** `t` bound to the `devices` namespace. */
export function useDevicesT() {
  return useTranslation("devices", { i18n }).t;
}

export const BUCKET_STATUS: Record<FleetBucket, OverviewStatus> = {
  ok: "ok",
  warn: "warn",
  crit: "crit",
  unknown: "unknown",
  unmeasured: "offline",
};

export const BUCKET_TEXT: Record<FleetBucket, string> = {
  ok: "text-[var(--wy-ok)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
  unknown: "text-[var(--wy-text-muted)]",
  unmeasured: "text-[var(--wy-text-faint)]",
};

export function useBucketLabel() {
  const t = useDevicesT();
  return (b: FleetBucket) =>
    ({
      ok: t("bucket.ok", "Online"),
      warn: t("bucket.warn", "Degraded"),
      crit: t("bucket.crit", "Down"),
      unknown: t("bucket.unknown", "Unknown"),
      unmeasured: t("bucket.unmeasured", "Not measured"),
    })[b];
}

export function useKindLabel() {
  const t = useDevicesT();
  return (k: FleetKind) =>
    ({
      router: t("kind.router", "Routers"),
      ap: t("kind.ap", "Access points"),
      other: t("kind.other", "Other hardware"),
    })[k];
}

/** "4 min ago" / "4 मिनट पहले", or an em dash -- the shared formatter
 * (`@/lib/format`) in the dashboard's language. */
export function relTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso || !Number.isFinite(new Date(iso).getTime())) return "—";
  return formatRelative(iso, i18n.language, { now, style: "short" });
}

/** Status words written in English by `@/lib/device-liveness`,
 * `@/lib/hardware-health` and `@/lib/location-liveness` (shared with the
 * Master console), looked up here by their English text so the Devices
 * screens show them in the dashboard language. Unknown words pass through. */
const STATUS_WORD_KEY: Record<string, string> = {
  Online: "online",
  Down: "down",
  Unstable: "unstable",
  "Not responding": "notResponding",
  "Status stale": "stale",
  "Not measured": "notMeasured",
  "Can't reach router": "cantReachRouter",
  "Not checked yet": "notCheckedYet",
  "Not monitored": "notMonitored",
  "Not seen on network": "notSeen",
  "Never observed": "neverObserved",
  "Gone quiet": "goneQuiet",
  "Can't confirm": "cantConfirm",
  "Never checked in": "neverCheckedIn",
  "Waiting for setup": "waitingForSetup",
  "Setup not started": "setupNotStarted",
  Suspended: "suspended",
  Retired: "retired",
  "Controller down": "controllerDown",
  "Managed by controller": "managedByController",
};
const TYPE_KEY: Record<string, string> = {
  "Access Point": "ap",
  Printer: "printer",
  Router: "router",
  Camera: "camera",
  Other: "other",
};
/** `(word) => translated word` for row status words and device types. */
export function useRowWords() {
  const t = useDevicesT();
  return {
    status: (w: string) => (STATUS_WORD_KEY[w] ? t(`statusWord.${STATUS_WORD_KEY[w]}`, w) : w),
    type: (w: string) => (TYPE_KEY[w] ? t(`hw.type.${TYPE_KEY[w]}`, w) : w),
  };
}
