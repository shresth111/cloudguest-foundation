/**
 * Retry a READ through a short server outage.
 *
 * Why this exists: on 2026-10-05 the Access Tiers tab at the Aruba staging
 * venue showed "Couldn't load this account's access tiers" while nothing was
 * wrong with the tiers. The box's nginx log has the whole story -- at
 * 17:05:26 and 17:05:29 UTC every `GET /policies?policy_type=...` and the
 * venue's `GET /ssid-tiers` came back **502**: the API container was being
 * recreated by a deploy and was back (healthy) a few seconds later. The page
 * tried once, caught the 502 and parked on the error until someone pressed
 * Try again.
 *
 * A gateway error or a dropped connection is the server being briefly away,
 * not an answer. So a read waits it out (a few seconds, backing off) before
 * the page says it failed. Anything the server actually ANSWERED -- 4xx,
 * 500 -- is returned at once: retrying a 403 or a crash only delays the
 * truth.
 *
 * Reads only. Never wrap a write in this: a 502 on a POST does not say
 * whether the write landed.
 */

/** 502/503/504 come from the proxy while the API is down or restarting;
 * `null` is the client's own "no response at all" (network error). */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

/** True when `err` means "the server was not there", not "the server said
 * no". Reads the `status` the api client rejects with (`AppError`), and an
 * axios-shaped `response.status` as a fallback. */
export function isTransientServerError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  if (e.code === "network_error") return true;
  const status = typeof e.status === "number" ? e.status : e.response?.status;
  return typeof status === "number" && TRANSIENT_STATUSES.has(status);
}

/** Default waits between attempts: ~17 s in all, enough for an API
 * container restart (the 2026-10-05 one was back within seconds of the
 * last 502). */
export const TRANSIENT_RETRY_DELAYS_MS: readonly number[] = [2000, 5000, 10000];

/**
 * Run `fn`; while it fails with a transient server error, wait and try
 * again, once per entry in `delaysMs`. Returns the first success; rethrows
 * the last error, or any non-transient error immediately.
 *
 * `isCancelled` is checked before every retry, so an unmounted screen stops
 * asking. `sleep` is injectable for tests.
 */
export async function retryTransient<T>(
  fn: () => Promise<T>,
  {
    delaysMs = TRANSIENT_RETRY_DELAYS_MS,
    isCancelled = () => false,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  }: {
    delaysMs?: readonly number[];
    isCancelled?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= delaysMs.length || !isTransientServerError(err) || isCancelled()) throw err;
      await sleep(delaysMs[attempt]);
      if (isCancelled()) throw err;
    }
  }
}
