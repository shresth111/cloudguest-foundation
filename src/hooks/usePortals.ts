import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { portalService } from "@/services/portal.service";
import type {
  Portal,
  PortalAd,
  PortalListQuery,
  PortalStatus,
} from "@/types/portal";

const K = {
  kpis: () => ["portal", "kpis"] as const,
  list: (q: PortalListQuery) => ["portal", "list", q] as const,
  detail: (id: string) => ["portal", "detail", id] as const,
  themes: () => ["portal", "themes"] as const,
  analytics: (id: string) => ["portal", "analytics", id] as const,
};

export const usePortalKpis = () =>
  useQuery({ queryKey: K.kpis(), queryFn: () => portalService.kpis() });

export const usePortalList = (query: PortalListQuery) =>
  useQuery({ queryKey: K.list(query), queryFn: () => portalService.list(query) });

export const usePortal = (id: string) =>
  useQuery({ queryKey: K.detail(id), queryFn: () => portalService.get(id), enabled: !!id });

export const usePortalThemes = () =>
  useQuery({ queryKey: K.themes(), queryFn: () => portalService.themes() });

export const usePortalAnalytics = (id: string) =>
  useQuery({ queryKey: K.analytics(id), queryFn: () => portalService.analytics(id), enabled: !!id });

export function useCreatePortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof portalService.create>[0]) => portalService.create(input),
    onSuccess: (p) => {
      toast.success(`Portal "${p.name}" created`);
      qc.invalidateQueries({ queryKey: ["portal"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create portal"),
  });
}

export function useUpdatePortal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Portal>) => portalService.update(id, patch),
    onSuccess: (p) => {
      qc.setQueryData(K.detail(id), p);
      qc.invalidateQueries({ queryKey: ["portal", "list"] });
      qc.invalidateQueries({ queryKey: K.kpis() });
    },
    onError: (e: Error) => toast.error(e.message || "Update failed"),
  });
}

export function useSetPortalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PortalStatus }) =>
      portalService.setStatus(id, status),
    onSuccess: (p) => {
      toast.success(`Portal ${p.status === "published" ? "published" : p.status}`);
      qc.invalidateQueries({ queryKey: ["portal"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDuplicatePortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalService.duplicate(id),
    onSuccess: (p) => {
      toast.success(`Duplicated as "${p.name}"`);
      qc.invalidateQueries({ queryKey: ["portal"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalService.remove(id),
    onSuccess: () => {
      toast.success("Portal deleted");
      qc.invalidateQueries({ queryKey: ["portal"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyTheme(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string) => portalService.applyTheme(id, themeId),
    onSuccess: (p) => {
      toast.success(`Theme "${p.themeName}" applied`);
      qc.setQueryData(K.detail(id), p);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveAsTheme(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => portalService.saveAsTheme(id, name),
    onSuccess: () => {
      toast.success("Saved as new theme");
      qc.invalidateQueries({ queryKey: K.themes() });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRestoreVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => portalService.restoreVersion(id, versionId),
    onSuccess: (p) => {
      toast.success("Version restored");
      qc.setQueryData(K.detail(id), p);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddAd(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ad: Omit<PortalAd, "id" | "impressions" | "clicks">) =>
      portalService.addAd(id, ad),
    onSuccess: (p) => {
      toast.success("Ad added");
      qc.setQueryData(K.detail(id), p);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveAd(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (adId: string) => portalService.removeAd(id, adId),
    onSuccess: (p) => {
      toast.success("Ad removed");
      qc.setQueryData(K.detail(id), p);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
