import { useEffect, useRef } from "react";
import { Laptop, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PG_SECONDARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { GuestSignInCard } from "@/components/portal-runtime/GuestSignInCard";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

/**
 * The DEMO portal's flow container (src/routes/preview.portal.demo.tsx, gated
 * on `PortalRuntimeState.demoMode`).
 *
 * It reads the runtime's `session` and swaps between the two demo screens,
 * keeping everything inside the demo route's OWN provider -- it never touches
 * a real `/portal/*` route:
 *   - No fake session yet -> render the real `GuestSignInCard`, which already
 *     owns the survey/image/text two-step (PR #154) and, in `demoMode`, runs
 *     the DUMMY OTP/password flow (see `useGuestSignIn`). So a demo config in
 *     survey mode still shows step 1 (survey + Continue) -> step 2 (sign-in)
 *     -> dummy OTP, exactly like a real guest, before landing here.
 *   - Fake session set (any 6-digit code / any password accepted) -> the
 *     self-contained `DemoConnectedCard` below. No navigation, no queries, no
 *     NAS POST.
 */
export function DemoPortalFlow() {
  const { session, setSession, setGuestIdentifier } = usePortalRuntime();

  // Always begin a demo at the sign-in step. `setSession` persists to
  // sessionStorage, so a fake session left by a previous demo run in this
  // browser would otherwise open the demo straight onto the connected screen.
  // One-shot on mount only -- a session the prospect sets during THIS run
  // (after mount) is untouched, so this never fights the live flow.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (session) {
      setSession(undefined);
      setGuestIdentifier(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (session) return <DemoConnectedCard />;
  return <GuestSignInCard />;
}

/** A demo-only "you're connected" illustration -- a lightweight sibling of
 * `portal.session.tsx`'s `ConnectedIllustration` (which is not exported), in
 * the same filled-flat-shape / venue-agnostic palette: a device, a signal
 * fan, and a green verified badge. Static (no motion dependency) -- it is
 * seen once, on a demo. */
function DemoConnectedIllustration({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 130" className={className} fill="none">
      <ellipse cx="100" cy="112" rx="66" ry="6" fill="#4338ca" opacity="0.06" />
      {/* Signal fan */}
      {[16, 28, 40].map((r, i) => (
        <path
          key={r}
          d={`M52 ${72 - r} A${r} ${r} 0 0 1 ${52 + r} 72`}
          stroke={["#a5b4fc", "#818cf8", "#6366f1"][i]}
          strokeOpacity={0.8 - i * 0.15}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      {/* Access point */}
      <rect x="26" y="82" width="52" height="26" rx="8" fill="#4338ca" />
      <rect x="26" y="82" width="52" height="26" rx="8" fill="#7c3aed" opacity="0.15" />
      <circle cx="52" cy="95" r="2.6" fill="#22d3ee" />
      {/* Guest device */}
      <rect
        x="120"
        y="20"
        width="40"
        height="60"
        rx="10"
        fill="white"
        stroke="#a78bfa"
        strokeWidth="1.8"
      />
      <rect x="126" y="28" width="28" height="44" rx="4" fill="#eef2ff" />
      {/* Verified badge */}
      <g>
        <circle cx="156" cy="72" r="13" fill="#10b981" stroke="white" strokeWidth="3" />
        <path
          d="M150 72l4 4l8-9"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

/**
 * The demo's self-contained "You're connected" screen. Deliberately reuses
 * the visual language of `portal.session.tsx` (the real resting page) --
 * `PortalTextPlate` hero, `PortalCard` rows -- but renders entirely from the
 * fake in-memory session, with no `useQuery`, no navigation, and no
 * hotspot/NAS POST. A "Start over" affordance clears the fake session and
 * returns the demo to step 1.
 */
function DemoConnectedCard() {
  const { t, session, setSession, setGuestIdentifier } = usePortalRuntime();

  const startOver = () => {
    setSession(undefined);
    setGuestIdentifier(undefined);
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="mx-auto w-fit max-w-full text-center">
        <PortalTextPlate>
          <DemoConnectedIllustration className="mx-auto h-28 w-auto sm:h-32" />
          <h1 className="pg-title mt-3 text-[var(--pg-ink)]">{t("connectedTitle")}</h1>
          <p className="mt-1 text-sm text-[var(--pg-ink-muted)]">{t("connectedSubtitle")}</p>
        </PortalTextPlate>
      </div>

      <PortalCard className="p-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]">
            <Laptop className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="pg-body font-semibold text-[var(--pg-ink)]">
              {session?.deviceName ?? t("device")}
            </p>
            <p className="truncate pg-meta font-normal text-[var(--pg-ink-muted)]">
              {session?.identifier}
            </p>
          </div>
        </div>
      </PortalCard>

      {/* An honest "this was a demo" note -- a prospect should never think a
       * real connection was made. Not a real guest-facing string, so it is
       * plain copy rather than a translated key. */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--pg-border)] bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_5%,var(--pg-surface,#fff))] p-3.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pr-primary,#6366f1)]" />
        <p className="pg-meta text-[var(--pg-ink-muted)]">
          This is a demo of the guest sign-in flow. No code was actually sent and no device was
          connected to any network.
        </p>
      </div>

      <button
        type="button"
        onClick={startOver}
        className={cn(PG_SECONDARY_BTN, "flex items-center justify-center gap-2")}
      >
        <RotateCcw className="h-4 w-4" /> Start over
      </button>
    </div>
  );
}
