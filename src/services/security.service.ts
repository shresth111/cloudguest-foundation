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
// `attachOrganizationScope` in services/api.ts. Nothing here sets it by hand
// and no method takes an `organizationId` -- see dns.service.ts's own note for
// why: a caller-resolved id ends up in the React Query key, and the key
// settling fired every read on the page twice.

export const securityService = {
  async overview(): Promise<SecurityOverview> {
    const { data } = await api.get<BackendOverview>("/security/overview");
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
   * backend has stopped claiming. */
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
