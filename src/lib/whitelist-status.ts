/**
 * "Is Whitelisting on at this venue?" -- answered the way the backend
 * decides it, so the dashboard notice cannot say ON while guests are being
 * let in, or OFF while they are being refused.
 *
 * The backend reads the flag off the portal config it resolves for the
 * venue (`CaptivePortalService.resolve_portal_config`): the venue's own
 * ACTIVE config if it has one, else the organization default. The flag is
 * refused on an organization default outright
 * (`validate_whitelist_only_scope`), so a venue is in whitelist-only mode
 * exactly when an active config of its own has it on. An inactive config
 * with the switch on is not enforced and must not light the notice.
 */
export interface PortalConfigFlagRow {
  location_id: string | null;
  is_active: boolean;
  whitelist_only_enabled?: boolean | null;
}

export function isWhitelistOnlyOn(
  configs: readonly PortalConfigFlagRow[],
  locationId: string,
): boolean {
  if (!locationId) return false;
  return configs.some(
    (c) => c.location_id === locationId && c.is_active && c.whitelist_only_enabled === true,
  );
}
