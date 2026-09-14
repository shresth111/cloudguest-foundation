import { useEffect, useState } from "react";
import { isDemo } from "@/services/customer.service";
import { ispService } from "@/services/isp.service";
import type { IspLink, IspHealthCheck } from "@/types/isp";
import type { BandwidthSeriesState } from "./dashboard.types";
import {
  DEMO_WAN_LINK,
  DEMO_WAN_BACKUP_LINK,
  DEMO_BANDWIDTH_CHECKS,
  BANDWIDTH_POLL_INTERVAL_MS,
} from "./dashboard.types";

export function useBandwidthSeries(locationId: string): BandwidthSeriesState {
  const [phase, setPhase] = useState<"loading" | "empty" | "ready">("loading");
  const [link, setLink] = useState<IspLink | null>(null);
  const [otherLinks, setOtherLinks] = useState<IspLink[]>([]);
  const [checks, setChecks] = useState<IspHealthCheck[]>([]);

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    setLink(null);
    setOtherLinks([]);
    setChecks([]);
    if (isDemo()) {
      setLink(DEMO_WAN_LINK);
      setOtherLinks([DEMO_WAN_BACKUP_LINK]);
      setChecks(DEMO_BANDWIDTH_CHECKS);
      setPhase("ready");
      return;
    }
    (async () => {
      try {
        const { rows } = await ispService.listLinks({ page: 1, pageSize: 100, locationId });
        const links = rows.filter((l) => l.locationId === locationId);
        const active = links.find((l) => l.isActiveUplink) ?? links[0];
        if (!alive) return;
        if (!active) {
          setPhase("empty");
          return;
        }
        setLink(active);
        setOtherLinks(links.filter((l) => l.id !== active.id));
      } catch {
        if (alive) setPhase("empty");
      }
    })();
    return () => {
      alive = false;
    };
  }, [locationId]);

  useEffect(() => {
    if (isDemo() || !link) return;
    let alive = true;
    const load = () => {
      ispService
        .listHealthChecks(link.id, { page: 1, pageSize: 60, locationId })
        .then((r) => {
          if (alive) {
            setChecks(r.rows);
            setPhase("ready");
          }
        })
        .catch(() => {
          // Transient poll failure keeps showing last known-good series
        });
    };
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer == null) timer = setInterval(load, BANDWIDTH_POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
        start();
      } else {
        stop();
      }
    };
    load();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [link, locationId]);

  if (phase === "empty") return { status: "empty" };
  if (phase === "ready" && link) return { status: "ready", link, checks, otherLinks };
  return { status: "loading" };
}
