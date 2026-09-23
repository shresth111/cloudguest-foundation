/**
 * Security posture types.
 *
 * Mirrors the backend's `app/domains/security/schemas.py`. Every counter and
 * the score itself carry their own `available` flag, and that is deliberate
 * rather than defensive: the backend distinguishes "we measured this and it is
 * zero" from "there is no source for this", and collapsing the two here would
 * throw that away one layer above where it was carefully preserved. A `null`
 * count with `available: false` means the latter.
 */

export type SecurityAvailability = "available" | "requires_additional_technology" | "not_supported";

export type SecurityScoreBand = "excellent" | "good" | "fair" | "poor";

export interface SecurityCounter {
  key: string;
  label: string;
  /** `null` when `available` is false -- never a fabricated zero. */
  count: number | null;
  available: boolean;
  unavailableReason: string | null;
  source: string | null;
}

export interface SecurityFleetSummary {
  routersTotal: number;
  routersReporting: number;
  routersStale: number;
  routersUnhealthy: number;
  vpnPeersActive: number;
  vpnPeersTotal: number;
  /** True when this venue has no gateway this platform manages -- every figure
   * above is then zero by absence rather than by health. */
  noManagedGateway: boolean;
}

export interface SecurityScoreFactor {
  key: string;
  label: string;
  penalty: number;
  maxPenalty: number;
  affected: number;
  available: boolean;
  detail: string;
}

export interface SecurityScore {
  /** `null` when `available` is false: no managed gateway, so no posture. */
  score: number | null;
  band: SecurityScoreBand | null;
  maxScore: number;
  available: boolean;
  unavailableReason: string | null;
  factors: SecurityScoreFactor[];
  computedAt: string;
}

export interface SecurityOverview {
  score: SecurityScore;
  counters: SecurityCounter[];
  fleet: SecurityFleetSummary;
  generatedAt: string;
}

export interface SecurityFeature {
  key: string;
  label: string;
  availability: SecurityAvailability;
  /** The real mechanism, in technical terms. Operator-console vocabulary --
   * see the capability panel's own note before rendering this to a customer. */
  enforcement: string | null;
  detail: string;
}
