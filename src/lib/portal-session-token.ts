/**
 * The signed `session_token` a real guest login returns (backend QA
 * 2026-11-06, H1), remembered by `sessionId` so every session-mutating
 * portal call can send it back as proof that this browser signed in.
 *
 * Why a small registry rather than a field threaded through every caller:
 * the token has to survive the hotspot hand-off, which is a full top-level
 * navigation, and it has to reach six call sites that already pass only
 * `guestId`/`sessionId`. Remembering it here and attaching it inside
 * `portalRuntimeService` keeps those call sites untouched.
 *
 * Storage is best-effort. Apple's Captive Network Assistant throws on any
 * Web Storage access, so every read and write is wrapped and the in-memory
 * copy is the fallback. A missing token is not an error today: the backend
 * still accepts the bare `guest_id`/`session_id` pair while
 * `guest_session_token_enforcement` is `off`.
 *
 * `GET /guest/session/active` never returns a token (anyone who knows a
 * router id and a MAC can call it), so a resumed session simply has none.
 */
const STORAGE_KEY = "wyfy:guest-session-tokens";
const MAX_REMEMBERED = 5;

const memory = new Map<string, string>();

function readStored(): Array<[string, string]> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is [string, string] =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "string",
    );
  } catch {
    return [];
  }
}

export function rememberSessionToken(sessionId: string, token: string | null | undefined): void {
  if (!sessionId || !token) return;
  memory.set(sessionId, token);
  try {
    const entries = readStored().filter(([id]) => id !== sessionId);
    entries.push([sessionId, token]);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_REMEMBERED)));
  } catch {
    // CNA / private mode: the in-memory copy above is all there is.
  }
}

export function sessionTokenFor(sessionId: string | null | undefined): string | undefined {
  if (!sessionId) return undefined;
  const cached = memory.get(sessionId);
  if (cached) return cached;
  const stored = readStored().find(([id]) => id === sessionId)?.[1];
  if (stored) memory.set(sessionId, stored);
  return stored;
}
