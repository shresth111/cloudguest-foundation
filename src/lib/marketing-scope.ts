/**
 * Who a Marketing request speaks for: the whole organization, or one venue.
 * (wyfy-specs/guest-marketing-campaigns.md §5.0 "Location scoping rules".)
 *
 * ORG-SCOPED callers (organization owner / admin, MSP roles, and platform
 * operators with a GLOBAL role) send NO `X-Location-Id`. The backend then
 * treats them as org-wide: lists cover every venue, a campaign may target
 * all venues or a chosen subset (`audience_filter.location_ids`), and an
 * org-wide campaign has `location_id: null`.
 *
 * LOCATION-SCOPED callers (location manager and every other role granted at
 * a venue) ALWAYS send `X-Location-Id` for their venue. The backend confines
 * them to it regardless (LocScope), so the header only makes the request
 * say what the server will enforce anyway.
 *
 * DECIDED FROM REAL RBAC DATA, NEVER THE LOGIN RADIO. The input is the
 * role assignments the backend returned at sign-in (`RoleAssignment[]`,
 * each with its `scopeType` and ids) -- the same list the api interceptor
 * reads to decide `X-Organization-Scope`. `cg_login_role` (the Owner/Staff
 * radio on the sign-in form, a known defect) is not read here at all.
 *
 * FAILS NARROW. With no role information at all, or only location-level
 * grants, the answer is location-scoped. Sending `X-Location-Id` can only
 * ever narrow what a request sees; omitting it for someone who is really
 * location-scoped would ask the server for an org-wide view it will refuse.
 *
 * Dependency-free so `scripts/test-marketing-ui.mjs` can execute it.
 */

export interface ScopeRole {
  scopeType: string;
  organizationId?: string | null;
  locationId?: string | null;
}

export type MarketingScope =
  | { kind: "organization"; organizationId: string | null }
  | { kind: "location"; locationId: string | null };

export function resolveMarketingScope(
  roles: readonly ScopeRole[] | null | undefined,
  organizationId: string | null,
  activeLocationId: string | null,
): MarketingScope {
  const list = Array.isArray(roles) ? roles : [];
  const orgWide = list.some(
    (r) =>
      r?.scopeType === "global" ||
      (r?.scopeType === "organization" &&
        (!r.organizationId || !organizationId || r.organizationId === organizationId)),
  );
  if (orgWide) return { kind: "organization", organizationId };
  return { kind: "location", locationId: activeLocationId };
}

/** The `X-Location-Id` a marketing request carries under `scope`: the venue
 * for a location-scoped caller, and nothing at all for an org-scoped one. */
export function marketingLocationHeader(scope: MarketingScope): string | null {
  return scope.kind === "location" ? scope.locationId : null;
}

/**
 * A venue selection in the composer, as the contract wants it (§5.5 POST
 * `location_id`, §5.3 `audience_filter.location_ids`):
 *
 *   - all venues      -> location_id null,  location_ids null
 *   - exactly one     -> location_id = it,  location_ids [it]
 *   - several         -> location_id null,  location_ids [...]
 *
 * Exactly one venue becomes the campaign's own `location_id` on purpose:
 * §4.5 defines `location_id` as the campaign's venue ("null = org-wide"),
 * and §5.0 rule 2 makes a campaign visible to that venue's location-scoped
 * staff only when `location_id` is theirs. A one-venue campaign filed as
 * org-wide would be hidden from the very manager of the venue it targets,
 * and `location_name` in the message would render as the org name instead
 * of the venue's (§5.0 variable resolution).
 */
export function campaignLocationFields(venueIds: readonly string[] | null): {
  location_id: string | null;
  location_ids: string[] | null;
} {
  if (!venueIds || venueIds.length === 0) return { location_id: null, location_ids: null };
  const unique = Array.from(new Set(venueIds));
  if (unique.length === 1) return { location_id: unique[0], location_ids: [unique[0]] };
  return { location_id: null, location_ids: unique };
}
