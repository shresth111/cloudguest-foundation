import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAudienceCandidates } from "@/hooks/useMarketing";
import type { AudienceFilter } from "@/types/marketing";
import {
  audienceFilterInvalid,
  cleanAudienceFilter,
  formatDateTime,
  marketingErrorMessage,
} from "../marketing-helpers";

const PAGE_SIZE = 25;

/**
 * Everyone the filters reach, or only the people picked here. The list holds
 * only guests who can really be messaged, and the server applies consent again
 * to every pick at preview, at dispatch and per message, so picking can only
 * narrow an audience.
 */
export function RecipientPicker({
  filter,
  onChange,
}: {
  filter: AudienceFilter;
  onChange: (guestIds: string[] | null) => void;
}) {
  const { t } = useTranslation("marketing", { i18n });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const picked = filter.guest_ids ?? null;
  const choosing = picked !== null;

  const base = { ...filter, guest_ids: null };
  const candidates = useAudienceCandidates(
    choosing && !audienceFilterInvalid(base) ? cleanAudienceFilter(base) : null,
    search,
    page,
    PAGE_SIZE,
  );
  const items = candidates.data?.items ?? [];
  const total = candidates.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pickedSet = new Set(picked ?? []);
  const pageIds = items.map((g) => g.guest_id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => pickedSet.has(id));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(pickedSet);
    if (on) next.add(id);
    else next.delete(id);
    onChange([...next]);
  };
  const togglePage = (on: boolean) => {
    const next = new Set(pickedSet);
    for (const id of pageIds) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  };

  return (
    <div
      className="space-y-3 rounded-[var(--wy-radius)] border border-[var(--wy-border)] p-3"
      data-testid="recipient-picker"
    >
      <p className="text-sm font-semibold">{t("picker.title", "Who gets this")}</p>
      <div className="flex flex-wrap gap-4 text-sm" role="radiogroup">
        <label className="flex items-center gap-2">
          <input type="radio" checked={!choosing} onChange={() => onChange(null)} />
          {t("picker.everyone", "Everyone matching the filters")}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={choosing} onChange={() => onChange(picked ?? [])} />
          {t("picker.choose", "Choose people")}
        </label>
      </div>

      {choosing && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="h-8 max-w-xs"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("picker.search", "Search by name")}
              aria-label={t("picker.search", "Search by name")}
            />
            <span className="text-xs text-muted-foreground" data-testid="picked-count">
              {t("picker.pickedCount", "{{count}} picked", { count: pickedSet.size })}
            </span>
          </div>
          {candidates.isError ? (
            <p className="text-sm text-[var(--wy-crit)]">
              {marketingErrorMessage(
                candidates.error,
                t("picker.loadFailed", "Couldn't load the list of guests."),
              )}
            </p>
          ) : !candidates.data ? (
            <p className="text-sm text-muted-foreground">{t("picker.loading", "Loading…")}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("picker.none", "Nobody here has opted in to this channel.")}
            </p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={allOnPage}
                  onCheckedChange={(v) => togglePage(v === true)}
                  aria-label={t("picker.pickPage", "Pick everyone on this page")}
                />
                {t("picker.pickPage", "Pick everyone on this page")}
              </label>
              <ul className="divide-y divide-[var(--wy-border)] text-sm">
                {items.map((g) => {
                  const name = g.display_name ?? t("picker.noName", "No name");
                  return (
                    <li key={g.guest_id} className="flex items-center gap-2 py-1.5">
                      <Checkbox
                        checked={pickedSet.has(g.guest_id)}
                        onCheckedChange={(v) => toggle(g.guest_id, v === true)}
                        aria-label={t("picker.pickOne", "Pick {{name}}", { name })}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {name}{" "}
                        <span className="font-mono text-xs text-muted-foreground">
                          {g.masked_address ?? ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(g.last_seen_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {pages > 1 && (
                <div className="flex items-center justify-end gap-2 text-xs">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {t("picker.previous", "Previous")}
                  </Button>
                  <span>
                    {page} / {pages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("picker.next", "Next")}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
