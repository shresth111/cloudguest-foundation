import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal-runtime/PortalShell";
import { GuestSignInCard } from "@/components/portal-runtime/GuestSignInCard";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/welcome")({
  errorComponent: PortalErrorScreen,
  component: WelcomePage,
});

/**
 * The guest's real landing screen (see src/routes/portal.index.tsx --
 * `/portal/` auto-redirects here once config resolves). This is the
 * redesigned guest sign-in card described by the guest-portal visual
 * spec: centered white card, logo mark, "Welcome to [venue]" heading, a
 * pill two-tab toggle, and each tab's real, already-working backend call
 * -- all of the actual field/tab/OTP-inline logic lives in
 * GuestSignInCard so it stays in one place regardless of which route
 * renders it.
 */
function WelcomePage() {
  const { isLoading } = usePortalRuntime();

  return (
    <PortalShell>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : (
        <GuestSignInCard />
      )}
    </PortalShell>
  );
}
