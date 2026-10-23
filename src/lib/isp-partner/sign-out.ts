/**
 * Ending a partner-console session without tripping "Your session has expired"
 * (QA-019 B, QA-020, test box 2026-10-23).
 *
 * The shared `api` client sends any non-login 401 to `/session-expired`. A
 * sign-out used to drop the token while partner queries were still in flight
 * or about to refetch (the Overview's 60 s poll, for one). The next one came
 * back 401 with no token, so every deliberate sign-out, and the
 * suspended-ISP screen, ended on "session expired".
 *
 * `endPartnerSession` closes that gap without touching `api.ts`:
 *  1. **Gate.** Every new request except `/auth/*` is refused before it leaves
 *     the browser. The refusal is a cancel, not a 401, so the interceptor
 *     ignores it.
 *  2. **Cancel and drain.** It cancels the queries and waits (bounded) for
 *     requests already on the wire to finish. They still carry a valid token.
 *  3. **Log out.** Only then does it call `logout()`.
 *
 * The gate stays closed until a public partner page (sign in / forgot /
 * reset) opens it again.
 */
import axios, { type AxiosInstance } from "axios";
import type { QueryClient } from "@tanstack/react-query";

let installedOn: AxiosInstance | null = null;
let inFlight = 0;
let closed = false;

const PASS_WHILE_CLOSED = ["/auth/"];

export function installSignOutGate(instance: AxiosInstance): void {
  if (installedOn === instance) return;
  installedOn = instance;
  instance.interceptors.request.use((config) => {
    const url = config.url ?? "";
    if (closed && !PASS_WHILE_CLOSED.some((p) => url.startsWith(p))) {
      return Promise.reject(new axios.CanceledError("partner session is ending"));
    }
    inFlight += 1;
    (config as { _ispCounted?: boolean })._ispCounted = true;
    return config;
  });
  const done = (config: unknown) => {
    const c = config as { _ispCounted?: boolean } | undefined;
    if (c?._ispCounted) {
      c._ispCounted = false;
      inFlight = Math.max(0, inFlight - 1);
    }
  };
  instance.interceptors.response.use(
    (res) => {
      done(res.config);
      return res;
    },
    (err) => {
      done((err as { config?: unknown })?.config);
      return Promise.reject(err);
    },
  );
}

export function isSignOutGateClosed(): boolean {
  return closed;
}

export function openSignOutGate(): void {
  closed = false;
}

async function drain(timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (inFlight > 0 && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Close the gate, cancel + drain, then `logout()`. Never throws. */
export async function endPartnerSession(opts: {
  queryClient: QueryClient;
  logout: () => Promise<void>;
  drainMs?: number;
}): Promise<void> {
  closed = true;
  try {
    await opts.queryClient.cancelQueries();
  } catch {
    /* cancelling is best effort */
  }
  await drain(opts.drainMs ?? 4000);
  try {
    await opts.logout();
  } catch {
    /* logout() already clears the local session on failure */
  }
}

/** Test hook. */
export function __signOutGateState() {
  return { inFlight, closed, installed: installedOn !== null };
}
