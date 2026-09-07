import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PortalShell, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN, PG_SECONDARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { GlyphExpired } from "@/components/portal-runtime/PortalGlyphs";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { enabledAuthMethods } from "@/lib/portal-auth-methods";

export const Route = createFileRoute("/portal/expired")({
  errorComponent: PortalErrorScreen,
  component: ExpiredPage,
});

/**
 * Reached four ways, and until this change only the last three existed --
 * which is why a screen that looks finished was, in practice, one almost
 * no real guest ever saw:
 *
 *  1. **A returning guest whose session ended.** `/portal/` asks
 *     `checkLastEndedSession` on arrival and routes here when the backend
 *     reports an ending recent enough to mention. This is the case the
 *     screen was written for and the one it never used to get: a session
 *     runs for hours, so it ends with the portal long since closed, and
 *     the guest's next browser tap took them to a sign-in form identical
 *     to a first-time visitor's.
 *  2. A guest tapping Disconnect on `/portal/session`.
 *  3. `/portal/session` finding no session object after its own live
 *     check.
 *  4. `/portal/success` finding no session object.
 *
 * The previous version of this docstring said 2 and 3 happened on the
 * *success* screen, via a `session_timeout_minutes` countdown hitting
 * zero. Both halves were wrong by the time it was read: Disconnect lives
 * on `/portal/session` (`/portal/success` is transient -- it fires the
 * hotspot form POST and moves on), and while `/portal/session` does render
 * a countdown from `session_timeout_minutes`, nothing navigates when it
 * reaches zero. It was a description of a route that was reached from
 * almost nowhere, and it read as though the screen were wired up. That is
 * how it stayed unreachable, so it is worth being exact here.
 *
 * Copy varies by *why* the session ended (cases 2-4 supply no reason and
 * keep the original generic wording). The reason is a two-value enum from
 * the backend, never a `disconnect_reason` string -- see
 * `RuntimeEndedSessionReason`. An operator's block deliberately produces
 * no reason and no navigation here at all: that guest goes to the ordinary
 * sign-in page, where the refusal is worded correctly.
 *
 * "Sign in again" defaults to the password tab, "Use OTP instead"
 * switches to the OTP tab -- both by setting the same real
 * `selectedMethod` context field GuestSignInCard already reads to pick its
 * initial tab, then navigating back to the one real sign-in card (no
 * separate expired-specific form).
 *
 * Offering an immediate sign-in is correct *today* and is a decision with
 * an expiry date. Every venue is on the platform default of 240 minutes
 * because until now there was no setting to choose one with, so a session
 * ending carries no venue intent to respect -- it is an accident of a
 * default, and the guest should simply get back online. A venue that
 * deliberately picks a short timeout to turn tables over is expressing
 * something different, and at that point "Sign in again, immediately,
 * unconditionally" needs revisiting rather than inheriting.
 */
function ExpiredPage() {
  const { t, config, setSelectedMethod, endedSession } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/expired" });

  const methods = config ? enabledAuthMethods(config) : [];
  const hasPassword = methods.includes("username_password");
  const hasOtp = methods.includes("otp_sms") || methods.includes("otp_email");
  const preferredOtp = methods.includes("otp_sms") ? "otp_sms" : "otp_email";

  const goSignIn = (method: "username_password" | "otp_sms" | "otp_email") => {
    setSelectedMethod(method);
    navigate({ to: "/portal/welcome", search: (prev) => prev });
  };

  // The venue's own session length, in the largest unit that stays exact,
  // so a 240-minute venue reads "4 hours" rather than "240 minutes" and a
  // 30-minute one reads "30 minutes". Anything that is not a whole number
  // of hours (a 90-minute setting, say) stays in minutes rather than being
  // rounded into a number the venue never chose. Built from separate keys
  // per unit because word order and the number's position move per
  // language -- the same reason every other `{n}` string on this surface
  // is substituted at the call site instead of inside translate().
  const durationLabel = (minutes: number): string | null => {
    if (minutes <= 0) return null;
    if (minutes % 60 !== 0) return t("expiredDurationMinutes").replace("{n}", String(minutes));
    const hours = minutes / 60;
    if (hours === 1) return t("expiredDurationHour");
    return t("expiredDurationHours").replace("{n}", String(hours));
  };

  // Falls back to the original generic pair whenever there is no reason to
  // be specific about -- which is every route into this screen other than
  // a real arrival check (a Disconnect tap, a lost session object). Those
  // guests are not owed an explanation of a timeout that may not have
  // happened, and inventing one would be worse than the general wording.
  //
  // The timed-out body needs the venue's length to say anything useful, so
  // a missing or unusable `sessionTimeoutMinutes` drops back to the
  // generic line rather than rendering a sentence with a hole in it.
  const duration = endedSession?.sessionTimeoutMinutes
    ? durationLabel(endedSession.sessionTimeoutMinutes)
    : null;
  // Same "a number or nothing" treatment as `duration` above, for the idle
  // copy: the venue's idle timeout as THIS session carried it. A session
  // that recorded none (any that started before the backend began storing
  // it) gets the reason without a number rather than a sentence with a hole.
  const idleDuration = endedSession?.idleTimeoutMinutes
    ? durationLabel(endedSession.idleTimeoutMinutes)
    : null;

  // A switch rather than the nested ternary this used to be. The chain was
  // already re-testing `=== "timed_out"` in its second arm to catch the
  // no-duration case, and two more reasons would have made it unreadable in
  // exactly the place where being wrong means telling a guest something
  // false about their own connection.
  const copy = (): { title: string; body: string } => {
    switch (endedSession?.reason) {
      case "timed_out":
        // Needs the venue's length to say anything useful; without it the
        // dropped copy is truer than a sentence with a hole in it.
        return duration
          ? {
              title: t("expiredTimedOutTitle"),
              body: t("expiredTimedOutBody").replace("{n}", duration),
            }
          : { title: t("expiredDroppedTitle"), body: t("expiredDroppedBody") };
      case "idle_timed_out":
        // Deliberately not the timed-out copy. "Your WiFi time is up" is
        // false here -- this guest used none of their time, which is
        // precisely why they were signed out -- and it is the reading a
        // guest is most likely to arrive at on their own, so saying it
        // would confirm a wrong guess.
        return idleDuration
          ? {
              title: t("expiredIdleTitle"),
              body: t("expiredIdleBody").replace("{n}", idleDuration),
            }
          : { title: t("expiredIdleTitle"), body: t("expiredIdleBodyNoDuration") };
      case "time_limit_reached":
        // The one ending where "sign in again" is wrong advice: the backend
        // refuses that login until the day rolls over. The CTAs are
        // suppressed below to match.
        return {
          title: t("expiredDailyLimitTitle"),
          body: t("expiredDailyLimitBody"),
        };
      case "disconnected":
        return { title: t("expiredDroppedTitle"), body: t("expiredDroppedBody") };
      default:
        return { title: t("sessionExpired"), body: t("expiredSubtitle") };
    }
  };
  const { title, body } = copy();

  // Whether signing in again can actually work. For every other ending it
  // can, and offering it is the whole point of the screen. For a spent
  // daily allowance it cannot: `_enforce_fup_quota` refuses the next login
  // outright, so a button here would walk the guest into a bare refusal and
  // read as "the WiFi is broken". Showing no button is not a missing
  // feature; it is the honest shape of "come back tomorrow".
  const canSignInAgain = endedSession?.reason !== "time_limit_reached";

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1). The plate is
         * `PortalTextPlate` -- the one seam that owns "is there a photo",
         * the bounded `w-fit` sizing that is deliberately NOT a wash over
         * the whole content column (§0.1 item 1's twice-shipped mistake),
         * and §1.4 C5's refusal rule. Its own doc comment carries the
         * reasoning this used to copy per route.
         *
         * The wrapper `<div>` is this route's layout box, not the plate,
         * and has to stay: with no photo the plate renders its children
         * bare, so without this box they would drop straight into the
         * column's `gap-5` and lose `text-center`. */}
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            {/* Amber stays: it is the one semantic "caution, not error"
             * hue on this surface. amber-500 -> amber-600 lifts the 40px
             * glyph from 2.85:1 to 3.9:1 on white (SC 1.4.11's 3:1
             * non-text floor). GlyphExpired is the brand set's hourglass. */}
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-50 text-amber-600">
              <GlyphExpired className="h-8 w-8" />
            </div>
            <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{title}</h1>
            {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
             * §1.5 retuned that token #64748B -> #475569, and a slate class does
             * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
             * composite (`--pg-surface` at 85% over a near-black photo region);
             * full derivation in styles.css's own `--pg-ink-muted` note. Backing
             * the block and leaving its subtitle at 3.36:1 would only have half-
             * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
            <p className="mt-1 pg-meta text-[var(--pg-ink-muted)]">{body}</p>
            {/* Was a whole PortalCard whose entire content was this one
             * grey sentence -- 68px of opaque surface on a short viewport
             * for a helper line. Folded into the plate (both lines now sit
             * on the same composited backing the alpha floors guarantee),
             * which also uncovers more of the venue photo -- the opposite
             * of the twice-reverted column wash (§0.1 item 1). */}
            {/* Only in the generic case. The reason-specific bodies above
             * each end with their own "sign in again" clause, so keeping
             * this third line would say the same thing twice in a row
             * directly beneath a button that says it a third time. The
             * original pair (`sessionExpired` + `expiredSubtitle`) is two
             * short statements with no call to action, which is what this
             * line was written to supply -- so it stays exactly where it
             * still earns its place. */}
            {!endedSession && (
              <p className="mt-3 pg-meta text-[var(--pg-ink-faint)]">{t("expiredHelp")}</p>
            )}
          </PortalTextPlate>
        </div>
        <div className="flex flex-col gap-2.5">
          {canSignInAgain && hasPassword && (
            <button
              type="button"
              onClick={() => goSignIn("username_password")}
              className={PG_PRIMARY_BTN}
            >
              {t("signInAgainLink")}
            </button>
          )}
          {canSignInAgain && hasOtp && (
            <button
              type="button"
              onClick={() => goSignIn(preferredOtp)}
              className={hasPassword ? PG_SECONDARY_BTN : PG_PRIMARY_BTN}
            >
              {t("useOtpInsteadLabel")}
            </button>
          )}
          {canSignInAgain && !hasPassword && !hasOtp && (
            <button
              type="button"
              onClick={() => navigate({ to: "/portal/welcome", search: (prev) => prev })}
              className={PG_PRIMARY_BTN}
            >
              {t("reconnect")}
            </button>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
