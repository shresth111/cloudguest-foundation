/** `GET /isp/logs/netlogs/per-second` (backend logs_rate_router.py). */
import { api } from "@/services/api";

export interface NetLogsPerSecond {
  feature_enabled: boolean;
  since: string;
  until: string;
  step_seconds: 1;
  counts: number[];
  total: number;
  peak: number;
  clock: "received_at";
  throttle_per_router_per_minute: number;
  throttled_minutes: { router_id: string; minute: string; count: number }[];
}

export type PerSecondWindow =
  | { kind: "preset"; minutes: 5 | 15 | 60 }
  | { kind: "custom"; since: string; until: string };

export async function fetchNetLogsPerSecond(
  scope: Record<string, string>,
  window: PerSecondWindow,
): Promise<NetLogsPerSecond> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(scope)) {
    if (!v || k === "since" || k === "until" || k === "cursor") continue;
    params[k] = v;
  }
  if (window.kind === "preset") params.minutes = String(window.minutes);
  else {
    params.since = window.since;
    params.until = window.until;
  }
  const { data } = await api.get<NetLogsPerSecond>("/isp/logs/netlogs/per-second", { params });
  return data;
}

/** Same cap as the backend (3 hours at 1-second buckets). */
export const PER_SECOND_MAX_MS = 3 * 60 * 60 * 1000;
