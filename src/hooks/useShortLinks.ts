import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shortLinkService } from "@/services/short-link.service";
import type { CreateShortLinkPayload, UpdateShortLinkPayload } from "@/types/short-link";

export const shortLinkKeys = {
  all: ["short-links"] as const,
  list: (page: number) => ["short-links", "list", page] as const,
  detail: (id: string) => ["short-links", "detail", id] as const,
};

export function useShortLinks(page = 1) {
  return useQuery({
    queryKey: shortLinkKeys.list(page),
    queryFn: () => shortLinkService.list(page),
  });
}

export function useShortLink(id: string) {
  return useQuery({
    queryKey: shortLinkKeys.detail(id),
    queryFn: () => shortLinkService.get(id),
    enabled: !!id,
  });
}

export function useCreateShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateShortLinkPayload) => shortLinkService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: shortLinkKeys.all }),
  });
}

export function useUpdateShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateShortLinkPayload }) =>
      shortLinkService.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: shortLinkKeys.all });
      qc.invalidateQueries({ queryKey: shortLinkKeys.detail(id) });
    },
  });
}

export function useDeleteShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shortLinkService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: shortLinkKeys.all }),
  });
}
