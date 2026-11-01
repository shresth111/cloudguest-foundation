import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useIsDemo, useMyPermissions } from "@/hooks/useCustomerDashboard";
import { guestAccessKeys } from "@/hooks/useGuestAccess";
import { resolveActiveOrganizationId } from "@/services/api";
import { guestService } from "@/services/guest.service";
import { useCustomerStore } from "@/stores/customerStore";
import { resolveMarketingScope } from "@/lib/marketing-scope";
import { canOfferUnblock, type UnblockRule } from "@/lib/guest-unblock";
import type { AnyAccessRule } from "@/types/guest";

/**
 * The block rules behind Guests' row-level Unblock (lib/guest-unblock.ts).
 *
 * Who the request speaks for is decided from the caller's REAL role
 * assignments, the same way Marketing decides it (lib/marketing-scope.ts):
 * an org-scoped owner sends no `X-Location-Id`; a venue-scoped front-desk
 * account always sends its venue, because the backend checks its grant
 * there. `cg_login_role` (the sign-in radio) is not read.
 *
 * The demo workspace has no backend; it carries one blocked number that is
 * also one of its demo guests, so the row action is visible there.
 */
export function useGuestUnblock() {
  const demo = useIsDemo();
  const { roles } = useAuth();
  const activeLocationId = useCustomerStore((s) => s.activeLocationId) ?? null;
  const { data: permissions } = useMyPermissions();
  const orgId = resolveActiveOrganizationId();
  const scope = resolveMarketingScope(roles, orgId, activeLocationId);
  const venueScoped = scope.kind === "location";
  const venueHeader = venueScoped ? activeLocationId : null;
  const offered = canOfferUnblock(permissions);
  const qc = useQueryClient();
  const queryKey = [...guestAccessKeys.rules, "unblock", orgId, venueHeader, demo] as const;

  const rules = useQuery({
    queryKey,
    enabled: offered && (demo || !!orgId),
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<(UnblockRule & { source: AnyAccessRule | null })[]> => {
      if (demo) return demoRules(activeLocationId);
      const all = await guestService.listAccessRules(orgId ?? undefined, venueHeader);
      return all.map((r) => ({
        id: r.id,
        kind: r.kind,
        ruleType: r.ruleType,
        isActive: r.isActive,
        locationId: r.locationId,
        expiresAt: r.expiresAt,
        identifier: r.kind === "identifier" ? r.identifier : undefined,
        macAddress: r.kind === "device" ? r.macAddress : undefined,
        source: r,
      }));
    },
  });

  const unblock = useMutation({
    mutationFn: async (rule: Pick<UnblockRule, "id" | "kind">) => {
      if (demo) return;
      if (rule.kind === "device") {
        await guestService.deactivateDeviceRule(rule.id, orgId ?? undefined, venueHeader);
      } else {
        await guestService.deactivateAccessRule(
          "identifier",
          rule.id,
          orgId ?? undefined,
          venueHeader,
        );
      }
    },
    onSuccess: (_void, rule) => {
      // Drop it from this list at once (the demo has nothing to refetch),
      // then let Blocking's own list catch up.
      qc.setQueryData<UnblockRule[]>(queryKey, (prev) =>
        prev?.map((r) => (r.id === rule.id ? { ...r, isActive: false } : r)),
      );
      if (!demo) qc.invalidateQueries({ queryKey: guestAccessKeys.rules });
    },
  });

  return { offered, venueScoped, rules: rules.data ?? [], unblock };
}

function demoRules(venueId: string | null): (UnblockRule & { source: null })[] {
  return [
    {
      id: "demo-block-1",
      kind: "identifier",
      ruleType: "blocklist",
      isActive: true,
      locationId: venueId,
      expiresAt: null,
      // Matches the demo guest "John Doe" (+91 98765 43210), and is the
      // same number Blocking's own demo list shows as blocked.
      identifier: "+919876543210",
      source: null,
    },
  ];
}
