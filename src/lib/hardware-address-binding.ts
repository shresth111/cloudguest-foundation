import type { AddressBinding } from "@/services/deviceHardware.service";

/** What to tell the owner right after Add Device about the device's IP:
 * registration makes its current DHCP lease static on the router, so the
 * address stays bound to this MAC (backend `address_binding`). `null`
 * when there is nothing worth saying (an older backend, the demo, or a
 * controller-managed venue where no RouterOS lease table exists). */
export function describeAddressBinding(
  binding: AddressBinding | null | undefined,
): { tone: "success" | "info" | "warning"; message: string } | null {
  if (!binding) return null;
  switch (binding.status) {
    case "pinned":
      return {
        tone: "success",
        message: `Static IP ${binding.ipAddress} is now bound to this device.`,
      };
    case "already_static":
      return {
        tone: "success",
        message: `This device already has a static IP: ${binding.ipAddress}.`,
      };
    case "no_lease":
      return {
        tone: "info",
        message:
          "The device has no IP from the router yet. Its IP will be made static automatically once it connects.",
      };
    case "conflict":
      return {
        tone: "warning",
        message:
          "The router refused to fix this device's IP (the address is reserved for another device). Check the router's DHCP leases.",
      };
    case "failed":
      return {
        tone: "warning",
        message:
          "Could not reach the router to fix this device's IP. It will be retried automatically.",
      };
    default:
      return null;
  }
}
