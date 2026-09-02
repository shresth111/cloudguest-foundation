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

export function useActivateNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nasId: string) => nasService.activate(nasId),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

export function useDisableNas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nasId, reason }: { nasId: string; reason?: string }) =>
      nasService.disable(nasId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: nasKeys.all }),
  });
}

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
