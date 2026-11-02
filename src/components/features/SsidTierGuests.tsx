/**
 * The guest list of one paid WiFi network at an Aruba Instant On venue: how an
 * owner gives a specific guest the faster network, or takes it away. Each entry
 * is a guest assignment on the network's Access Tier, which RADIUS and the
 * portal already read (backend `SsidTierRepository.entitlement_for`), so it
 * counts the next time that guest connects to the network.
 *
 * Mounted only from `SsidSpeedTiers`, which only an Aruba venue renders.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { requestErrorMessage } from "@/services/api";
import { bandwidthPolicyService } from "@/services/bandwidth-policy.service";
import { resolveOrgId } from "@/services/customer.service";
import { guestService } from "@/services/guest.service";
import { ssidTiersService } from "@/services/ssid-tiers.service";
import { ssidGuestListTierName, type SsidTier, type SsidTiersView } from "@/lib/ssid-tiers";

const kbps = (mbps: number | null) => (mbps == null ? 0 : mbps * 1000);

export function SsidTierGuests({
  locationId,
  row,
  rows,
}: {
  locationId: string;
  /** The saved row. Never a draft: its network must exist before it has a list. */
  row: SsidTier;
  rows: SsidTier[];
}) {
  const { t } = useTranslation("accessRules", { i18n });
  const qc = useQueryClient();
  const listKey = ["ssid-tier-guests", locationId, row.policyId];
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ id: string; label: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: listKey,
    enabled: !!row.policyId,
    queryFn: async () => {
      const org = await resolveOrgId();
      const mappings = await bandwidthPolicyService.guestMappings(
        row.policyId as string,
        locationId,
        org,
      );
      return Promise.all(
        mappings.map(async (m) => {
          const guest = await guestService.get(m.guestId, org).catch(() => null);
          return {
            ...m,
            label: guest?.displayName
              ? `${guest.displayName} · ${guest.identifier}`
              : (guest?.identifier ?? t("ssidGuests.unknownGuest", "Guest")),
          };
        }),
      );
    },
  });

  // Safe to repeat after a partial failure: the tier is found again by name, and
  // the location mapping and the row update are both idempotent.
  const ensureTier = async (org: string): Promise<string> => {
    if (row.policyId) return row.policyId;
    const name = ssidGuestListTierName(row.ssid);
    const existing = (await bandwidthPolicyService.list(org)).find(
      (p) => p.name === name && p.status !== "archived",
    );
    const policyId =
      existing?.id ??
      (
        await bandwidthPolicyService.save(
          {
            name,
            status: "active",
            downloadRateKbps: kbps(row.downloadMbps),
            uploadRateKbps: kbps(row.uploadMbps),
          },
          org,
        )
      ).id;
    await bandwidthPolicyService.mapTierToLocation(policyId, locationId, org);
    const view: SsidTiersView = await ssidTiersService.replace(
      locationId,
      rows.map((r) => (r.ssid === row.ssid ? { ...r, policyId } : r)),
    );
    qc.setQueryData(["ssid-tiers", locationId], view);
    return policyId;
  };

  const find = useMutation({
    mutationFn: async () => {
      const org = await resolveOrgId();
      const { rows: found } = await guestService.list({
        search: search.trim(),
        page: 1,
        pageSize: 10,
        organizationId: org,
        locationId,
      });
      return found
        .filter((g) => g.locationId === locationId)
        .map((g) => ({
          id: g.id,
          label: g.displayName ? `${g.displayName} · ${g.identifier}` : g.identifier,
        }));
    },
    onMutate: () => setError(null),
    onSuccess: setResults,
    onError: (e) =>
      setError(requestErrorMessage(e, t("ssidGuests.searchFailed", "Couldn't search guests."))),
  });

  const add = useMutation({
    mutationFn: async (guestId: string) => {
      const org = await resolveOrgId();
      const policyId = await ensureTier(org);
      await bandwidthPolicyService.mapGuestToLocation(policyId, locationId, guestId, org);
    },
    onMutate: () => setError(null),
    onSuccess: () => {
      setResults(null);
      setSearch("");
      void qc.invalidateQueries({ queryKey: ["ssid-tier-guests", locationId] });
    },
    onError: (e) =>
      setError(requestErrorMessage(e, t("ssidGuests.addFailed", "Couldn't add this guest."))),
  });

  const remove = useMutation({
    mutationFn: async (assignmentId: string) => {
      const org = await resolveOrgId();
      await bandwidthPolicyService.unmapGuestFromLocation(
        row.policyId as string,
        assignmentId,
        org,
      );
    },
    onMutate: () => setError(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: listKey }),
    onError: (e) =>
      setError(requestErrorMessage(e, t("ssidGuests.removeFailed", "Couldn't remove this guest."))),
  });

  const entries = list.data ?? [];
  const listedIds = new Set(entries.map((m) => m.guestId));

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3" data-testid="ssid-tier-guests">
      <p className="text-sm font-medium">
        {t("ssidGuests.title", "Guests who can use {{ssid}}", { ssid: row.ssid })}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          "ssidGuests.hint",
          "Add a guest here and they can join this network without a voucher, from their next connection. Removing them stops the next connection, not one already online.",
        )}
      </p>
      {list.isError ? (
        <p className="text-sm text-destructive">
          {t("ssidGuests.loadFailed", "Couldn't load this network's guest list.")}
        </p>
      ) : entries.length === 0 && !list.isLoading ? (
        <p className="text-xs text-muted-foreground" data-testid="ssid-tier-guests-empty">
          {t("ssidGuests.empty", "No guests added yet.")}
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((m) => (
            <li
              key={m.assignmentId}
              className="flex items-center justify-between gap-2 text-sm"
              data-testid="ssid-tier-guest"
            >
              <span className="min-w-0 truncate">{m.label}</span>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-destructive disabled:opacity-50"
                disabled={remove.isPending}
                onClick={() => remove.mutate(m.assignmentId)}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                {t("ssidGuests.remove", "Remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (search.trim()) find.mutate();
        }}
      >
        <input
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
          value={search}
          aria-label={t("ssidGuests.searchLabel", "Find a guest by phone or email")}
          placeholder={t("ssidGuests.searchLabel", "Find a guest by phone or email")}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md border px-3 text-sm disabled:opacity-50"
          disabled={find.isPending || !search.trim()}
        >
          {find.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t("ssidGuests.find", "Find")}
        </button>
      </form>
      {results && results.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t(
            "ssidGuests.noResults",
            "No guest found at this location. A guest appears here after signing in once.",
          )}
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="space-y-1">
          {results.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{g.label}</span>
              {listedIds.has(g.id) ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("ssidGuests.alreadyAdded", "Already added")}
                </span>
              ) : (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium disabled:opacity-50"
                  disabled={add.isPending}
                  onClick={() => add.mutate(g.id)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t("ssidGuests.add", "Add")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
