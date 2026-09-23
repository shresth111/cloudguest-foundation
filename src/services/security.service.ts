import { api } from "@/services/api";
import type {
  SecurityAvailability,
  SecurityCounter,
  SecurityFeature,
  SecurityOverview,
  SecurityScore,
  SecurityScoreBand,
  SecurityScoreFactor,
} from "@/types/security";

interface BackendCounter {
  key: string;
  label: string;
  count: number | null;
  available: boolean;
  unavailable_reason: string | null;
  source: string | null;
}

interface BackendScoreFactor {
  key: string;
  label: string;
  penalty: number;
  max_penalty: number;
  affected: number;
  available: boolean;
  detail: string;
}

interface BackendScore {
  score: number | null;
  band: SecurityScoreBand | null;
  max_score: number;
  available: boolean;
  unavailable_reason: string | null;
  factors: BackendScoreFactor[];
  computed_at: string;
}

interface BackendOverview {
  score: BackendScore;
  counters: BackendCounter[];
  fleet: {
    routers_total: number;
    routers_reporting: number;
    routers_stale: number;
    routers_unhealthy: number;
    vpn_peers_active: number;
    vpn_peers_total: number;
    no_managed_gateway: boolean;
  };
  generated_at: string;
}

interface BackendFeature {
  key: string;
  label: string;
  availability: SecurityAvailability;
  enforcement: string | null;
  detail: string;
}

function toCounter(c: BackendCounter): SecurityCounter {
  return {
    key: c.key,
    label: c.label,
    count: c.count,
    available: c.available,
    unavailableReason: c.unavailable_reason,
    source: c.source,
  };
}

function toFactor(f: BackendScoreFactor): SecurityScoreFactor {
  return {
    key: f.key,
    label: f.label,
    penalty: f.penalty,
    maxPenalty: f.max_penalty,
    affected: f.affected,
    available: f.available,
    detail: f.detail,
  };
}

function toScore(s: BackendScore): SecurityScore {
  return {
    score: s.score,
    band: s.band,
    maxScore: s.max_score,
    available: s.available,
    unavailableReason: s.unavailable_reason,
    factors: s.factors.map(toFactor),
    computedAt: s.computed_at,
  };
}

// Tenant scope rides on `X-Organization-Id`, attached to every request by
// `attachOrganizationScope` in services/api.ts. The venue is different: it is
// named per request, by the caller, and only when one is selected.
//
// This is the same shape the customer dashboard, ISP and analytics services
// already use for a location-scoped read. It is passed in rather than read off
// the store inside the service so the header and the React Query key cannot
// disagree -- the key is what decides when to refetch on a venue switch, and a
// service quietly reading a newer venue than the key was computed for would
// refetch the wrong thing.

function locationHeaders(locationId?: string | null): Record<string, string> | undefined {
  // Absent, not empty: with no venue selected the backend resolves no
  // location and reads organization-wide, which is the honest answer for a
  // caller who has not picked one.
  return locationId ? { "X-Location-Id": locationId } : undefined;
}

export const securityService = {
  async overview(locationId?: string | null): Promise<SecurityOverview> {
    const { data } = await api.get<BackendOverview>("/security/overview", {
      headers: locationHeaders(locationId),
    });
    return {
      score: toScore(data.score),
      counters: data.counters.map(toCounter),
      fleet: {
        routersTotal: data.fleet.routers_total,
        routersReporting: data.fleet.routers_reporting,
        routersStale: data.fleet.routers_stale,
        routersUnhealthy: data.fleet.routers_unhealthy,
        vpnPeersActive: data.fleet.vpn_peers_active,
        vpnPeersTotal: data.fleet.vpn_peers_total,
        noManagedGateway: data.fleet.no_managed_gateway,
      },
      generatedAt: data.generated_at,
    };
  },

  /** What this platform can and cannot enforce, from the one place that knows.
   *
   * Deliberately fetched rather than hardcoded here: a capability must be
   * advertised only where it can be honoured, and a second copy of that list
   * in the frontend is exactly how a dashboard ends up offering a control the
   * backend has stopped claiming. Not venue-scoped, and takes no location:
   * what this platform can enforce is a property of the platform, not of the
   * venue looking at it. */
  async capabilities(): Promise<SecurityFeature[]> {
    const { data } = await api.get<{ features: BackendFeature[] }>("/security/capabilities");
    return data.features.map((f) => ({
      key: f.key,
      label: f.label,
      availability: f.availability,
      enforcement: f.enforcement,
      detail: f.detail,
    }));
  },
};
