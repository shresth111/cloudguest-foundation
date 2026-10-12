/**
 * The backend's refusal of a device operation on an Aruba Instant On row
 * (cloud-guest #360): HTTP 409 with `data.code = "NAS_ONLY_DEVICE"` and
 * `data.operation` = "connected_devices" | "reboot". DASHBOARD_PLAN P1-H.
 *
 * Only that exact code is recognised, so no MikroTik or Omada error can ever
 * be reworded by this module.
 */
export const NAS_ONLY_DEVICE_CODE = "NAS_ONLY_DEVICE";

export function isNasOnlyDeviceRefusal(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown; data?: unknown };
  const data = e.data && typeof e.data === "object" ? (e.data as { code?: unknown }) : null;
  return e.status === 409 && data?.code === NAS_ONLY_DEVICE_CODE;
}

/** The owner-facing sentence for that refusal, or null for any other error. */
export function nasOnlyDeviceRefusalMessage(err: unknown): string | null {
  if (!isNasOnlyDeviceRefusal(err)) return null;
  const op = (err as { data?: { operation?: unknown } }).data?.operation;
  return op === "reboot"
    ? "Aruba Instant On access points are restarted from the Instant On app, not from Wyfy."
    : "Devices on Aruba Instant On access points are managed in the Instant On app, not from Wyfy.";
}
