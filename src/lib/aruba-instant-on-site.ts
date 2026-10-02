/**
 * Adding (and removing) an Aruba Instant On site in Router Fleet. Master
 * console only, like the rest of the Instant On setup (PM_SPEC §0.1 item 2).
 *
 * One Instant On site is one fleet row (`vendor = "aruba_instant_on"`) at one
 * Wyfy location (PM_SPEC §0.1 items 4-5). The backend route is
 * `POST /platform/routers/instant-on-sites`, GLOBAL-scoped; it refuses:
 *
 *   - a location that is not in the chosen organization (422),
 *   - a location that already has an Instant On row (409, `already_onboarded`),
 *   - an Instant On site id another live row already uses (409),
 *   - a location that already has another device or a network integration
 *     (409, `location_has_other_devices` / `location_has_network_integration`)
 *     -- the customer dashboard treats a venue as Instant On only when EVERY
 *     device there is (`locationIsNasOnly`), so a mixed venue would show
 *     controls that do nothing for the Aruba guests.
 *
 * Pure, so `scripts/test-aruba-add-site.mjs` can exercise it without a DOM.
 */
import { isNasOnlyVendor } from "@/lib/router-vendors";

export interface AddInstantOnSiteDraft {
  organizationId: string;
  locationId: string;
  name: string;
  serialNumber: string;
  macAddress: string;
  siteId: string;
  siteName: string;
}

export const EMPTY_INSTANT_ON_SITE_DRAFT: AddInstantOnSiteDraft = {
  organizationId: "",
  locationId: "",
  name: "",
  serialNumber: "",
  macAddress: "",
  siteId: "",
  siteName: "",
};

/** What the backend answered on create. */
export interface CreatedInstantOnSite {
  routerId: string;
  name: string;
  serialNumber: string;
  macAddress: string;
  syntheticSerialNumber: boolean;
  syntheticMacAddress: boolean;
}

const MAC_RE = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;

/** `aa-bb-cc-dd-ee-ff`, `aabbccddeeff` and `AA:BB:..` all become `AA:BB:..`;
 * anything else is returned trimmed and upper-cased so the error names what
 * was typed. */
export function normalizeMac(value: string): string {
  const raw = value.trim().toUpperCase();
  const hex = raw.replace(/[^0-9A-F]/g, "");
  if (hex.length === 12 && /^[0-9A-F:.\s-]+$/.test(raw)) {
    return hex.match(/.{2}/g)!.join(":");
  }
  return raw;
}

/** Field errors, keyed by draft field. Empty when the draft can be sent. The
 * backend checks all of this again; this only saves a round trip. */
export function validateInstantOnSiteDraft(
  draft: AddInstantOnSiteDraft,
): Partial<Record<keyof AddInstantOnSiteDraft, string>> {
  const errors: Partial<Record<keyof AddInstantOnSiteDraft, string>> = {};
  if (!draft.organizationId) errors.organizationId = "Choose the customer.";
  if (!draft.locationId) errors.locationId = "Choose the location this Instant On site serves.";
  const name = draft.name.trim();
  if (!name) errors.name = "Give the device a name.";
  else if (name.length > 200) errors.name = "200 characters at most.";
  if (draft.serialNumber.trim().length > 100) errors.serialNumber = "100 characters at most.";
  if (draft.macAddress.trim() && !MAC_RE.test(normalizeMac(draft.macAddress))) {
    errors.macAddress = "Use the AP's MAC as six hex pairs, e.g. 54:F0:B1:C8:A9:0A.";
  }
  if (draft.siteId.trim().length > 100) errors.siteId = "100 characters at most.";
  if (draft.siteName.trim().length > 200) errors.siteName = "200 characters at most.";
  // The backend stores the name WITH the site mapping, so a name with no id
  // has nowhere to go and is refused (422). Said here, on the field.
  else if (draft.siteName.trim() && !draft.siteId.trim()) {
    errors.siteName = "Enter the Instant On site id too — the name is stored with it.";
  }
  return errors;
}

/** The request body. Optional fields are OMITTED when blank, never sent as
 * `""` or null: the backend reads an absent serial/MAC as "mint a visibly
 * synthetic one", and its schema forbids unknown keys. */
export function buildInstantOnSiteBody(draft: AddInstantOnSiteDraft): Record<string, string> {
  const body: Record<string, string> = {
    organization_id: draft.organizationId,
    location_id: draft.locationId,
    name: draft.name.trim(),
  };
  const serial = draft.serialNumber.trim();
  if (serial) body.serial_number = serial;
  const mac = draft.macAddress.trim();
  if (mac) body.mac_address = normalizeMac(mac);
  const siteId = draft.siteId.trim();
  if (siteId) body.instant_on_site_id = siteId;
  const siteName = draft.siteName.trim();
  if (siteName) body.instant_on_site_name = siteName;
  return body;
}

export function toCreatedInstantOnSite(data: unknown): CreatedInstantOnSite {
  const d = (data ?? {}) as Record<string, unknown>;
  const router = (d.router ?? {}) as Record<string, unknown>;
  return {
    routerId: String(router.id ?? ""),
    name: String(router.name ?? ""),
    serialNumber: String(router.serial_number ?? ""),
    macAddress: String(router.mac_address ?? ""),
    syntheticSerialNumber: d.synthetic_serial_number === true,
    syntheticMacAddress: d.synthetic_mac_address === true,
  };
}

/** Fleet rows already at a location, as far as the fleet list can see. Used
 * to warn before submitting; the backend is the authority. */
export function devicesAlreadyAtLocation<
  T extends { locationId: string; vendor: string; name: string },
>(routers: readonly T[], locationId: string): T[] {
  if (!locationId) return [];
  return routers.filter((r) => r.locationId === locationId);
}

/** The one-sentence pre-submit warning for a location that already has a
 * device, or null. Mirrors the backend's refusal so the operator is not
 * surprised by it. */
export function locationConflictWarning(
  existing: readonly { vendor: string; name: string }[],
): string | null {
  if (existing.length === 0) return null;
  const aruba = existing.find((r) => isNasOnlyVendor(r.vendor));
  if (aruba) {
    return `This location already has an Instant On site ("${aruba.name}"). One Instant On site maps to one location; open that row's Instant On setup instead.`;
  }
  return `This location already has ${existing.length === 1 ? "a device" : `${existing.length} devices`} (${existing
    .map((r) => r.name)
    .join(
      ", ",
    )}). An Instant On site needs a location of its own, so this will be refused. Create a new location for the Instant On site, or remove the other device first.`;
}

/** The backend's refusal, for the dialog: its own sentence verbatim, plus the
 * row it pointed at when the location is already onboarded. */
export function instantOnSiteRefusal(error: unknown): {
  message: string;
  existingRouterId: string | null;
} {
  const e = (error ?? {}) as { message?: unknown; data?: Record<string, unknown> };
  const message =
    typeof e.message === "string" && e.message
      ? e.message
      : "The Instant On site could not be added.";
  const existing = e.data?.existing_router_id;
  return { message, existingRouterId: typeof existing === "string" ? existing : null };
}

// ---------------------------------------------------------------------------
// The Add Customer wizard's Aruba option (PM_SPEC §5 Wave 2)
// ---------------------------------------------------------------------------
//
// Same fields and the same rules as "Add Instant On site", minus the
// customer and location -- the wizard is creating those, in the same
// `POST /locations/provision` transaction. The backend validates the
// `instant_on_site` object with the very schema the Router Fleet route uses.

/** The Instant On site as the wizard's Device step holds it. */
export type InstantOnSiteFields = Omit<AddInstantOnSiteDraft, "organizationId" | "locationId">;

export const EMPTY_INSTANT_ON_SITE_FIELDS: InstantOnSiteFields = {
  name: "",
  serialNumber: "",
  macAddress: "",
  siteId: "",
  siteName: "",
};

/** `validateInstantOnSiteDraft` without the customer/location rules. */
export function validateInstantOnSiteFields(
  fields: InstantOnSiteFields,
): Partial<Record<keyof InstantOnSiteFields, string>> {
  const all = validateInstantOnSiteDraft({ ...fields, organizationId: "-", locationId: "-" });
  const errors: Partial<Record<keyof InstantOnSiteFields, string>> = {};
  for (const key of Object.keys(EMPTY_INSTANT_ON_SITE_FIELDS) as (keyof InstantOnSiteFields)[]) {
    if (all[key]) errors[key] = all[key];
  }
  return errors;
}

/** The `instant_on_site` object of `POST /locations/provision`: the "Add
 * Instant On site" body without `organization_id`/`location_id`. Blank
 * optionals are omitted -- the schema forbids unknown keys and reads an
 * absent serial/MAC as "mint a visibly synthetic one". */
export function buildProvisionInstantOnSite(fields: InstantOnSiteFields): Record<string, string> {
  const body = buildInstantOnSiteBody({ ...fields, organizationId: "", locationId: "" });
  delete body.organization_id;
  delete body.location_id;
  return body;
}

/** Why the static-IP question is asked, and what "No" means. Aruba Instant On
 * sends RADIUS from the venue's public address, and the hub authenticates a
 * NAS by that address -- a dynamic one breaks guest sign-in the next time it
 * changes. The fix for such a venue is a MikroTik gateway in front of the
 * APs, which is then the NAS. */
export const ARUBA_NO_STATIC_IP_WARNING =
  "Aruba Instant On needs a static public IP: the access points send RADIUS from the venue's public address, and the RADIUS hub only accepts a registered one. With a dynamic IP, guest sign-in stops working the next time the address changes. For this venue, put a MikroTik gateway in front of the access points and onboard the MikroTik instead — the APs then need no row of their own.";
