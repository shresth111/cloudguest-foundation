import { TOKEN_STORAGE_KEY } from "@/services/api";

/**
 * Decodes a JWT's middle (payload) segment client-side -- standard
 * base64url JSON, no library needed. Used only to read display/claim data
 * that already has a real, backend-enforced authorization check behind it
 * (the impersonation banner, see `getActiveImpersonationClaim` below) --
 * never as a substitute for a real permission check, which always goes
 * through `useAuth().can()` / a real API call instead.
 *
 * Never throws: a malformed, foreign, or truncated token just decodes to
 * `null` ("no claims"), the same as a token that legitimately has none.
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    // JWTs use base64url, not plain base64 -- `+`/`/` are replaced with
    // `-`/`_` and padding is dropped. `atob` only understands plain
    // base64, so translate back before decoding.
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as T;
  } catch {
    return null;
  }
}

/** Shape of the `impersonation` claim on an impersonation access token
 * (see `POST /users/{user_id}/impersonate`'s contract) -- absent entirely
 * (not just empty) on a normal login token.
 *
 * A TOP-LEVEL claim, not nested under an `additional_claims` key: the
 * backend's `JWTManager.create_access_token(additional_claims={...})`
 * names its own PARAMETER `additional_claims`, but the method's body is
 * `payload.update(additional_claims)` -- it merges those keys straight
 * into the top-level JWT payload alongside `sub`/`email`/`exp`, it does
 * not nest them under a JSON key of that same name. The real minted
 * token is `{..., "impersonation": {"actor_user_id": ..., ...}}`, not
 * `{..., "additional_claims": {"impersonation": {...}}}`. */
export interface ImpersonationClaim {
  actor_user_id: string;
  actor_email: string;
  started_at: string;
}

interface TokenClaims {
  impersonation?: ImpersonationClaim;
}

/** `null` for a normal session token, the claim payload for an
 * impersonation one. */
export function getImpersonationClaim(token: string): ImpersonationClaim | null {
  return decodeJwtPayload<TokenClaims>(token)?.impersonation ?? null;
}

/**
 * Reads the CURRENTLY ACTIVE session token straight out of storage and
 * decodes its impersonation claim, if any. This is the one check the
 * impersonation banner (`ImpersonationBanner.tsx`) needs, done in one place
 * so every render/tick re-derives from the same source of truth (the real
 * token) instead of trusting a flag that could drift from it.
 *
 * Guarded the same way `services/api.ts`'s own `safeLocalGet` is --
 * `localStorage` access can throw outright (Apple's captive-portal
 * webview, storage-disabled browsers), not just come back empty.
 */
export function getActiveImpersonationClaim(): ImpersonationClaim | null {
  if (typeof window === "undefined") return null;
  let token: string | null;
  try {
    token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
  return token ? getImpersonationClaim(token) : null;
}
