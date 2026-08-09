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
  isEnabled: boolean;
  createdAt: string;
}

export interface ContentFilterListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
  organizationId?: string;
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
  organizationId?: string;
}

export interface UpdateContentFilterRulePayload {
  name?: string;
  valueType?: ContentFilterValueType;
  value?: string;
  category?: ContentFilterCategory | null;
  comment?: string | null;
  isEnabled?: boolean;
}
