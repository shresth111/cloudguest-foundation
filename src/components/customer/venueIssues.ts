/**
 * ONE issue list per venue, shared by every health surface.
 *
 * The Dashboard computes "Needs attention" (`useNeedsAttention`) from reads it
 * already makes and publishes the result here. The top bar's health pill and
 * notification bell read it back, so the pill's count, the bell's count and
 * the Needs-attention card are the same list -- never three answers.
 *
 * NO REQUESTS. This module only stores what the Dashboard already computed.
 * Elsewhere it falls back, in order, to:
 *   1. the last list the Dashboard published this session (labelled with
 *      when it was checked), while it is under `FRESH_FOR_MS` old;
 *   2. router liveness alone -- the dashboard query's cache or the snapshot
 *      taken when the venue was picked (`useConsoleHealth`) -- run through
 *      the same `buildNeedsAttention`, and labelled as what it is: a router
 *      check, not "all systems".
 *
 * In memory only: a reload starts again from router liveness, which is
 * honest about what it knows.
 */
import { create } from "zustand";
import { useConsoleHealth } from "@/components/customer/useConsoleHealth";
import {
  buildNeedsAttention,
  type NeedsAttentionState,
} from "@/components/customer/dashboard/needsAttentionModel";

export { venueVerdict, type VenueVerdict, type VerdictLabel } from "./venueVerdict";

/** Older than this, a published list is not shown as the venue's state. */
export const FRESH_FOR_MS = 15 * 60_000;

interface Published {
  state: NeedsAttentionState;
  /** When the Dashboard computed it (ms epoch). */
  at: number;
  /** Cheap identity so an unchanged list does not re-render the shell. */
  signature: string;
}

interface VenueIssuesStore {
  byLocation: Record<string, Published>;
  publish: (locationId: string, state: NeedsAttentionState) => void;
}

function signatureOf(state: NeedsAttentionState): string {
  return JSON.stringify([
    state.items.map((i) => [
      i.kind,
      i.severity,
      i.params,
      i.actionId,
      i.routers?.map((r) => r.key),
    ]),
    state.unchecked,
    state.pending,
    state.checked,
  ]);
}

export const useVenueIssuesStore = create<VenueIssuesStore>()((set, get) => ({
  byLocation: {},
  publish: (locationId, state) => {
    const signature = signatureOf(state);
    const prev = get().byLocation[locationId];
    // Re-stamp the time even when nothing changed: "checked 1 min ago" must
    // follow the Dashboard's poll, not the last time something broke.
    if (prev && prev.signature === signature && Date.now() - prev.at < 30_000) return;
    set((s) => ({
      byLocation: { ...s.byLocation, [locationId]: { state, at: Date.now(), signature } },
    }));
  },
}));

export type { VenueIssues, VenueIssuesSource } from "./venueVerdict";
import type { VenueIssues } from "./venueVerdict";

/** The venue's issue list, from whatever this session already knows. `null`
 * when nothing is known at all (the shell then shows no verdict). */
export function useVenueIssues(locationId: string | null | undefined, now = Date.now()) {
  const published = useVenueIssuesStore((s) => (locationId ? s.byLocation[locationId] : undefined));
  const health = useConsoleHealth(locationId);
  if (published && now - published.at < FRESH_FOR_MS) {
    return { ...published.state, source: "full", checkedAt: published.at } as VenueIssues;
  }
  if (!health) return null;
  const routersOnly = buildNeedsAttention({
    liveness: { state: "ready", value: health.liveness },
    failedLogins: { state: "skip" },
    alerts: { state: "skip" },
    devices: { state: "skip" },
    plan: { state: "skip" },
    // Fix a Problem is on every role's sidebar; the pill always offered it.
    canOpen: () => true,
  });
  return {
    ...routersOnly,
    source: "routers",
    checkedAt: health.source === "live" ? health.updatedAt : null,
  } as VenueIssues;
}
