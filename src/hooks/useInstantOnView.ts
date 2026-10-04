import { useQuery } from "@tanstack/react-query";
import { isDemo } from "@/services/customer.service";
import { instantOnCustomerService } from "@/services/instant-on-customer.service";
import type { InstantOnKind, InstantOnView } from "@/lib/instant-on-views";

/**
 * One customer Instant On read (P1-K). Pass `undefined` for any venue that is
 * not Aruba Instant On: the query is then disabled and NO request is made.
 */
export function useInstantOnView<T>(
  locationId: string | undefined,
  kind: InstantOnKind,
  parse: (payload: unknown) => InstantOnView<T>,
): InstantOnView<T> {
  const enabled = !!locationId && !isDemo();
  const q = useQuery({
    queryKey: ["instant-on-customer", kind, locationId],
    queryFn: () => instantOnCustomerService.read(locationId!, kind),
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 0,
  });
  if (!enabled) return { status: "unavailable" };
  if (q.isLoading) return { status: "loading" };
  return parse(q.data);
}
