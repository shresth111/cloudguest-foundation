// Content Filtering: per-router website/IP blocking rules -- see
// app.domains.content_filtering (backend) for the full domain doc. A
// rule matches either a bare domain (DNS-sinkholed, blocks the domain
// and every subdomain) or an IP/CIDR (address-list + one shared
// firewall DROP rule) -- exactly one of the two, never both, and never
// a URL path/keyword (no Layer7/proxy interception -- see that
// backend module's own "honest scope" docstring section).
export type ContentFilterValueType = "domain" | "ip_cidr";

export type ContentFilterCategory =
  | "social_media"
  | "adult_content"
  | "gambling"
  | "streaming"
  | "gaming"
  | "custom";

export const CONTENT_FILTER_CATEGORY_LABELS: Record<ContentFilterCategory, string> = {
  social_media: "Social Media",
  adult_content: "Adult Content",
  gambling: "Gambling",
  streaming: "Streaming",
  gaming: "Gaming",
  custom: "Custom",
};

/** Whether this rule's real `/ip dns static` entries (a domain rule) or
 * `/ip firewall address-list` membership (an IP/CIDR rule) exist on the
 * router right now.
 *
 * Deliberately separate from `isEnabled`, which is only intent ("this site
 * should be blocked"): before this domain had a device push, a customer
 * could block a site, be shown that it was blocked, and reach it from the
 * guest network unchanged. Mirrors the backend's
 * `ContentFilterDevicePushStatus`. */
export type ContentFilterDevicePushStatus = "pending" | "active" | "failed";

export interface ContentFilterRule {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  name: string;
  category: ContentFilterCategory | null;
  valueType: ContentFilterValueType;
  value: string;
  comment: string | null;
  /** The app toggle (Block Websites -> Apps) that created this row, or null
   * for a website blocked by hand. */
  appKey: string | null;
  isEnabled: boolean;
  devicePushStatus: ContentFilterDevicePushStatus;
  /** Raw device error from the last failed push, shown verbatim. */
  devicePushError: string | null;
  devicePushedAt: string | null;
  createdAt: string;
}

export interface ContentFilterListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
  /** Leave out rows an app toggle created -- the "Specific websites" list,
   * so dozens of app names never push a hand-blocked site off its page. */
  excludeAppRules?: boolean;
}

export interface ContentFilterListResult {
  rows: ContentFilterRule[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateContentFilterRulePayload {
  routerId: string;
  name: string;
  valueType: ContentFilterValueType;
  value: string;
  category?: ContentFilterCategory | null;
  comment?: string | null;
  isEnabled?: boolean;
}

export interface UpdateContentFilterRulePayload {
  name?: string;
  valueType?: ContentFilterValueType;
  value?: string;
  category?: ContentFilterCategory | null;
  comment?: string | null;
  isEnabled?: boolean;
}

/** One name (or address range) of a catalogue app, on one router. */
export interface ContentFilterAppTarget {
  valueType: ContentFilterValueType;
  value: string;
  ruleId: string | null;
  /** False for a website the owner blocked by hand: counted, never removed
   * by the app's toggle. */
  owned: boolean;
  isEnabled: boolean;
  devicePushStatus: ContentFilterDevicePushStatus | null;
  devicePushError: string | null;
}

export type ContentFilterAppState = "blocked" | "partly_blocked" | "not_blocked";

/** One app in Block Websites -> Apps (backend
 * `content_filtering.app_catalogue`). */
export interface ContentFilterApp {
  key: string;
  name: string;
  category: string;
  /** A sentence about this app in particular, or null. */
  note: string | null;
  state: ContentFilterAppState;
  /** Whether the router holds the rows: null when there are none. */
  pushStatus: ContentFilterDevicePushStatus | null;
  targets: ContentFilterAppTarget[];
}

export interface ContentFilterAppList {
  routerId: string;
  items: ContentFilterApp[];
  /** The backend's own plain-language limits, shown as sent. */
  limitations: string[];
}
