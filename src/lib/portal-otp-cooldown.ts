import { useEffect, useState } from "react";
import type { AppError } from "@/services/api";

/**
 * v4 UX §3.2/§6.4: `GuestSignInCard`'s inline OTP resend used to start at
 * `resendCooldown = 0` (a guest could hammer resend immediately) and only
 * got a real cooldown once the server 429s and hands back
 * `retry_after_seconds`. The legacy full-page `/portal/verify` used a
 * fixed 60-second client-side countdown regardless of server truth.
 * Neither was "wrong" in isolation, but they disagreed -- a guest
 * bouncing between the inline flow and a bookmarked deep link got
 * inconsistent resend behavior for what should be the identical action.
 *
 * Single source of truth, shared by both: server-driven
 * (`retry_after_seconds`, read from a real 429) is the more honest
 * option, so this is the *only* mechanism now -- no fixed client-side
 * countdown anywhere. A resend is allowed immediately (cooldown 0) until
 * the server says otherwise, exactly matching what the server would have
 * allowed regardless of which entry point (inline card or deep link) a
 * guest happens to be on.
 */
export function useOtpResendCooldown() {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  /** Reads a real `retry_after_seconds` off a 429 `AppError` when present
   * -- the only source of truth for how long to actually wait, never an
   * invented fixed number. A non-429 error (already handled by the
   * caller's own error copy) leaves the cooldown untouched. */
  function applyServerCooldown(e: AppError) {
    const retryAfter = e.data?.retry_after_seconds;
    if (typeof retryAfter === "number") setCooldown(retryAfter);
  }

  function resetCooldown() {
    setCooldown(0);
  }

  return { cooldown, applyServerCooldown, resetCooldown };
}
