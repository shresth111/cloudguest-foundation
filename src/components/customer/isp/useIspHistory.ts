/**
 * Health history for the links on screen. Two reads per link, both on
 * endpoints this page already used before the revamp:
 *
 *   - `GET /isp/links/{id}/health-checks?page_size=30` -- the newest raw
 *     checks. Was the per-row status timeline's own read (12 rows); now the
 *     same one read also feeds the recent-checks list and "since". Fetched
 *     once per link id, not again on range change: the newest rows do not
 *     depend on the range.
 *   - `GET /isp/links/{id}/health-checks/summary` -- the backend's bucketed
 *     aggregates for the selected range. Was the history dialog's read; now
 *     the page's charts, uptime % and incident bands. Refetched only when
 *     the range changes.
 *
 * Plain state rather than React Query, matching the rest of this page and
 * the dashboard's own WAN hooks. Demo fixtures only behind `isDemo()`.
 * A failed read blanks only that link's section.
 */
import { useEffect, useState } from "react";
import { ispService } from "@/services/isp.service";
import type { IspHealthCheck, IspHealthCheckSummary } from "@/types/isp";
import { isCheckList, isSummary } from "./isp-model";
import { demoIspChecks, demoIspSummary, ISP_RANGE_HOURS, type IspRange } from "./isp.demo";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

export const RECENT_CHECKS_PAGE_SIZE = 30;

export function useIspRecentChecks(
  linkIds: string[],
  demo: boolean,
): { byLink: Record<string, Loadable<IspHealthCheck[]>>; retry: () => void } {
  const key = linkIds.join(",");
  const [byLink, setByLink] = useState<Record<string, Loadable<IspHealthCheck[]>>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const ids = key ? key.split(",") : [];
    if (demo) {
      setByLink(
        Object.fromEntries(ids.map((id) => [id, { status: "ready", data: demoIspChecks(id) }])),
      );
      return;
    }
    setByLink(Object.fromEntries(ids.map((id) => [id, { status: "loading" }])));
    ids.forEach((id) => {
      ispService
        .listHealthChecks(id, { page: 1, pageSize: RECENT_CHECKS_PAGE_SIZE })
        .then((r) => {
          if (!alive) return;
          const rows = r?.rows;
          setByLink((m) => ({
            ...m,
            [id]: isCheckList(rows) ? { status: "ready", data: rows } : { status: "error" },
          }));
        })
        .catch(() => {
          if (alive) setByLink((m) => ({ ...m, [id]: { status: "error" } }));
        });
    });
    return () => {
      alive = false;
    };
  }, [key, demo, tick]);
  return { byLink, retry: () => setTick((n) => n + 1) };
}

export function useIspSummaries(
  linkIds: string[],
  range: IspRange,
  demo: boolean,
): { byLink: Record<string, Loadable<IspHealthCheckSummary>>; retry: () => void } {
  const key = linkIds.join(",");
  const [byLink, setByLink] = useState<Record<string, Loadable<IspHealthCheckSummary>>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const ids = key ? key.split(",") : [];
    if (demo) {
      setByLink(
        Object.fromEntries(
          ids.map((id) => [id, { status: "ready", data: demoIspSummary(id, range) }]),
        ),
      );
      return;
    }
    setByLink(Object.fromEntries(ids.map((id) => [id, { status: "loading" }])));
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - ISP_RANGE_HOURS[range] * 3_600_000).toISOString();
    ids.forEach((id) => {
      ispService
        .getHealthCheckSummary(id, { startDate, endDate })
        .then((s) => {
          if (!alive) return;
          setByLink((m) => ({
            ...m,
            [id]: isSummary(s) ? { status: "ready", data: s } : { status: "error" },
          }));
        })
        .catch(() => {
          if (alive) setByLink((m) => ({ ...m, [id]: { status: "error" } }));
        });
    });
    return () => {
      alive = false;
    };
  }, [key, range, demo, tick]);
  return { byLink, retry: () => setTick((n) => n + 1) };
}
