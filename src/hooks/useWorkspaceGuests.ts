import { useQuery } from "@tanstack/react-query";
import { guestService } from "@/services/guest.service";

/**
 * Org-scoped guest detail + connection-history queries for the venue
 * surfaces (workspace + Users page) -- QA: "on click of a user we should
 * get details of the user, similar to a log of its connections."
 *
 * Deliberately SEPARATE from the hub's guest query keys
 * (``src/hooks/useGuests.ts``): the hub's ``sessionsForGuest`` fans out
 * across every organization (GLOBAL scope), which is 403/empty for an
 * org-owner and would poison the cache with the wrong data. Every key
 * here carries the organization id and every call passes
 * ``X-Organization-Id`` explicitly.
 */
export const workspaceGuestKeys = {
  detail: (organizationId: string, guestId: string) =>
    ["workspace", "guests", "detail", organizationId, guestId] as const,
  history: (
    organizationId: string,
    guestId: string,
    locationId: string | undefined,
    page: number,
  ) =>
    ["workspace", "guests", "history", organizationId, guestId, locationId ?? "org", page] as const,
};

export interface GuestHistoryQuery {
  guestId: string;
  organizationId?: string;
  locationId?: string;
  page: number;
  pageSize?: number;
}

export function useWorkspaceGuest(organizationId: string | undefined, guestId: string | null) {
  return useQuery({
    queryKey: workspaceGuestKeys.detail(organizationId ?? "", guestId ?? ""),
    queryFn: () => guestService.get(guestId!, organizationId),
    enabled: !!guestId && !!organizationId,
    staleTime: 30_000,
  });
}

export function useWorkspaceGuestHistory(query: GuestHistoryQuery) {
  const pageSize = query.pageSize ?? 20;
  return useQuery({
    queryKey: workspaceGuestKeys.history(
      query.organizationId ?? "",
      query.guestId,
      query.locationId,
      query.page,
    ),
    queryFn: () =>
      guestService.listSessions({
        organizationId: query.organizationId,
        locationId: query.locationId,
        guestId: query.guestId,
        page: query.page,
        pageSize,
      }),
    enabled: !!query.guestId && !!query.organizationId,
    staleTime: 15_000,
  });
}
