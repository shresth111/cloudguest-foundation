import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nasService } from "@/services/nas.service";
import type { CreateNasPayload, UpdateNasPayload } from "@/types/nas";

export const nasKeys = {
  all: ["nas"] as const,
  byLocation: (locationId: string) => ["nas", "location", locationId] as const,
  detail: (nasId: string) => ["nas", "detail", nasId] as const,
  byRouter: (routerId: string) => ["nas", "router", routerId] as const,
};

export function useLocationNas(locationId: string) {
  return useQuery({
    queryKey: nasKeys.byLocation(locationId),
    queryFn: () => nasService.listByLocation(locationId),
    enabled: !!locationId,
  });
}

export function useAllNas() {
  return useQuery({
    queryKey: nasKeys.all,
    queryFn: () => nasService.listAll(),
  });
}

export function useNas(nasId: string) {
  return useQuery({
    queryKey: nasKeys.detail(nasId),
    queryFn: () => nasService.get(nasId),
    enabled: !!nasId,
  });
}

export function useNasByRouter(routerId: string) {
  return useQuery({
    queryKey: nasKeys.byRouter(routerId),
    queryFn: () => nasService.getByRouterId(routerId),
    enabled: !!routerId,
  });
}

export function useCreateNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, payload }: { locationId: string; payload: CreateNasPayload }) =>
      nasService.create(locationId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

export function useUpdateNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nasId, payload }: { nasId: string; payload: UpdateNasPayload }) =>
      nasService.update(nasId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

// NO useActivateNas / useDisableNas HOOKS EITHER, for the same reason and
// as of the same day (2026-09-02, second pass).
//
// These two went with the rotation. All three were gated on
// `radius.execute`, which `organization-owner` holds at organization scope,
// so all three were reachable from the venue owner's own dashboard -- the
// first pass moved one and left these behind.
//
// Disable is the sharp one. It is a pure database write on the backend --
// no hub call, no device call -- and FreeRADIUS auth accepts only an
// `active` NAS, so clicking it stopped every guest login at that venue on
// the next request, with nothing the guest or the router could see naming
// the cause. It was reversible (Activate sat next to it), which is the one
// way it was gentler than the rotation, but no product surface ever asked
// for a venue-owner kill switch: these buttons existed because the
// backend's internal NasStatus graph had been mirrored into the customer
// UI. A venue owner's own "stop serving guests now" is captive-portal
// business hours / closed state, not a RADIUS client status.
//
// Both routes are `/platform/radius/nas/...` at GLOBAL scope now, so
// re-adding a hook here would 403 rather than break a venue -- but do not
// re-add it.

// NO useRegenerateNasSecret HOOK, deliberately (2026-09-02).
//
// The hooks in this file back the *customer* dashboard, and rotating a
// RADIUS shared secret is not a customer operation. It takes the venue's
// guest WiFi down the instant it succeeds -- the platform cannot write the
// new secret onto the router, so the old one keeps being rejected until
// somebody re-pastes the RADIUS chunk in WinBox -- and a venue owner has no
// way to finish it. It used to be a one-click button on the NAS detail page
// with no confirmation, reporting success.
//
// `nasService.regenerateSecret` is still there for the Master console,
// which calls it directly, and the route behind it is GLOBAL-scoped now:
// re-adding a hook here would 403 rather than break a venue, but do not
// re-add it.

export function useDeleteNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nasId: string) => nasService.remove(nasId),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}
