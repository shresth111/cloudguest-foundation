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

/** One protection's activity in a window -- `GET /security/activity`.
 *
 * `count` is `null` with `available: false` when the source could not be
 * read (Cloudflare without analytics access, a filter profile shared with
 * other venues). A protection that is not switched on is simply absent from
 * the list -- never present as a zero. */
export interface SecurityActivityProtection {
  key: string;
  label: string;
  count: number | null;
  available: boolean;
  unavailableReason: string | null;
  sentence: string | null;
  source: string;
  routersReporting: number | null;
  routersTotal: number | null;
  lastReadAt: string | null;
  topRules: { label: string; count: number }[];
}

export interface SecurityStaffChange {
  at: string;
  action: string;
  summary: string;
  description: string | null;
}

export type SecurityActivityWindow = "24h" | "7d";

export interface SecurityActivity {
  window: SecurityActivityWindow;
  since: string;
  until: string;
  protections: SecurityActivityProtection[];
  staffChanges: SecurityStaffChange[];
  routersTotal: number;
  semantics: string;
  generatedAt: string;
}
