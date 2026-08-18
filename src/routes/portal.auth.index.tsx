import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Bare `/portal/auth` (this method-picker menu, no `$method` segment) is
 * not a real guest entry point anymore -- the redesigned
 * `/portal/welcome` (GuestSignInCard) folded this same choice into its
 * own "New user / Registered user" tab toggle (a client-side state
 * change, not a URL navigation), and is the one real landing page a
 * guest's device/QR code/NAS redirect ever points at. The only remaining
 * legitimate callers of this exact bare route are internal
 * fallback-flow "go back and try again" links (portal.verify,
 * portal.failure, portal.set-password) -- for those, redirecting on to
 * `/portal/welcome` instead of rendering this standalone menu is a
 * strict improvement (same real sign-in options, the one entry point
 * users actually recognize).
 *
 * A *direct* hit on this URL shape -- hand-typed, bookmarked, or leaked
 * from somewhere that built one it shouldn't have (see
 * src/routes/preview.portal.$locationId.tsx's own history: it used to
 * generate exactly this, with a fake `routerId=preview`) -- must never
 * render this raw, out-of-context menu to a real end-user either. One
 * `beforeLoad` redirect covers both cases identically, since there is no
 * reliable way (or reason) to tell an internal "try again" click apart
 * from a direct hit for this particular route.
 *
 * v4: the standalone method-picker `component` this route used to fall
 * back to (for the case `beforeLoad` somehow doesn't run first) was
 * confirmed genuinely unreachable -- `beforeLoad` always throws before
 * any render is attempted -- and it was still hand-authored against the
 * deleted `PortalShell` "dark" visual language (`text-white`,
 * `bg-white/10`, etc.), which would have rendered illegibly (light text
 * on the new light-only shell) in the impossible event it ever did
 * render. Removed rather than ported, per v4's own "delete confirmed
 * dead code" mandate on `PortalShell`'s dark variant -- see
 * captive-portal-v4-design-spec.md §6/§8.
 */
export const Route = createFileRoute("/portal/auth/")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/portal/welcome", search });
  },
  // Never actually rendered (`beforeLoad` always throws first) -- kept as
  // a trivial no-op fallback, matching this codebase's convention for
  // every other `beforeLoad`-only-redirect route (see e.g. `agent.tsx`),
  // rather than fabricating real UI for a state that can't occur.
  component: () => null,
});
