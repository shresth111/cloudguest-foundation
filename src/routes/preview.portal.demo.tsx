import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { customerFeatureHref } from "@/lib/customerNav";
import { DEMO_PORTAL_PREVIEW_STORAGE_KEY } from "@/lib/portal-preview-storage";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";
import { DemoPortalFlow } from "@/components/portal-runtime/DemoPortalFlow";
import type { RuntimePortalConfig } from "@/types/portal-runtime";

/**
 * Demo-mode counterpart to `/preview/portal/$locationId`
 * (src/routes/preview.portal.$locationId.tsx) -- opened in a new tab from
 * the same "Preview Portal" button on a demo session's Portal Settings
 * page (src/components/features/PortalPage.tsx), which was previously
 * hidden outright in demo mode: "no real backend/org to preview" (there is
 * no real `captive_portal_configs`/`brandings` row a demo session could
 * fetch -- `usePortalPreview`'s two real backend sources both require a
 * real organizationId/locationId).
 *
 * Rather than fetching anything, this route reads the exact snapshot of
 * `PortalPage.tsx`'s own in-progress, unsaved `livePreviewConfig` --
 * written to localStorage under DEMO_PORTAL_PREVIEW_STORAGE_KEY right
 * before `window.open` -- and feeds it to the same real
 * PortalRuntimeProvider/PortalShell/GuestSignInCard tree the real preview
 * (and PortalPage's own embedded "Live Preview" card) already render, via
 * `presetConfig`. This can never drift from what a real guest sign-in
 * screen actually renders, same guarantee the real preview route documents
 * -- it's just fed from localStorage instead of a network fetch.
 *
 * Unlike the operator preview (`preview.portal.$locationId.tsx`), which
 * sets `previewMode` (every sign-in action short-circuits with a "connect a
 * real device" toast), this route sets `demoMode` and renders
 * `<DemoPortalFlow>`: a prospect can actually run the whole sign-in
 * (identifier -> OTP -> "You're connected") as a believable DUMMY flow --
 * no backend, no SMS/RADIUS, no NAS POST, no navigation out of this route.
 * See `PortalRuntimeState.demoMode` and `useGuestSignIn`'s demo branches.
 *
 * localStorage, not sessionStorage: this route is opened via
 * `window.open(url, "_blank", "noopener,noreferrer")`, and `noopener`
 * deliberately severs the new tab's `opener` relationship -- which per
 * the HTML spec also breaks sessionStorage inheritance into the new tab
 * (a new browsing context only inherits a *copy* of the opener's
 * sessionStorage when that opener relationship exists). The first version
 * of this route used sessionStorage and always showed the empty state
 * below in the new tab regardless of what PortalPage.tsx had just
 * written, confirmed live: the button/redirect worked, the new tab just
 * never saw the config. localStorage has no such opener-dependent
 * behavior.
 *
 * A visit with no stored config (someone bookmarking/reloading/sharing
 * this URL directly, or a browser profile where localStorage was cleared)
 * shows a plain empty state pointing back to Portal Settings, rather than
 * a blank or broken guest sign-in screen -- there is deliberately no
 * *server-side* persistence: demo config was never saved anywhere real to
 * begin with (see PortalPage.tsx's own `saveConfig`'s demo branch), so a
 * stale cross-device/cross-browser preview here would show a config an
 * admin doesn't currently have "open" anywhere, which is worse than an
 * honest "reopen the preview from Portal Settings" prompt.
 */
export const Route = createFileRoute("/preview/portal/demo")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    if (context.auth?.status === "anonymous") {
      const isAlreadyOnLogin =
        location.href === "/login" ||
        location.href.startsWith("/login?") ||
        location.href.startsWith("/login#");
      throw redirect({
        to: "/login",
        search: isAlreadyOnLogin ? undefined : { redirect: location.href },
      });
    }
  },
  component: DemoPortalPreviewPage,
});

function readStoredConfig(): RuntimePortalConfig | null {
  try {
    const raw = localStorage.getItem(DEMO_PORTAL_PREVIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RuntimePortalConfig) : null;
  } catch {
    return null;
  }
}

function DemoPortalPreviewPage() {
  // Read once on mount, not on every render -- this tab's own edits (if
  // any were made after opening it, which shouldn't normally happen since
  // this is a separate tab from Portal Settings) shouldn't cause a preview
  // that was just opened to silently re-render mid-view.
  const [config] = useState<RuntimePortalConfig | null>(readStoredConfig);

  // Demo sessions have no real state to persist across a refresh beyond
  // this one read -- nothing further to effect here, but documenting the
  // intentional one-shot read above rather than a live subscription.
  useEffect(() => {}, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f9fc]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 px-2 text-white/80 hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link to={customerFeatureHref("portal")}>
              <ArrowLeft className="h-4 w-4" />
              Back to Portal Settings
            </Link>
          </Button>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <MonitorSmartphone className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
                Guest sign-in preview
              </p>
              <p className="truncate text-base font-semibold">Demo portal preview</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-xs text-amber-100 backdrop-blur-sm">
            Demo session -- this reflects your unsaved edits on Portal Settings, not a real, hosted
            guest portal.
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-2 max-w-5xl px-4 pb-12 sm:px-6">
        {config ? (
          <div className="mx-auto w-full max-w-3xl">
            <div className="rounded-t-2xl border-8 border-b-0 border-[#1e1b4b] bg-[#1e1b4b] p-2 shadow-2xl">
              <div className="relative min-h-[600px] w-full rounded-lg bg-white">
                <PortalRuntimeProvider
                  organizationId="demo"
                  locationId="demo"
                  routerId="preview"
                  demoMode
                  presetConfig={config}
                  presetConfigLoading={false}
                >
                  {/* `DemoPortalFlow` owns its own `PortalShell` now (the
                      campaign step brings a different one) -- wrapping it in a
                      second shell here would nest two backdrops. The venue's
                      own post-login page and redirect target ride along from
                      the same unsaved snapshot, so the demo runs the same
                      four-step arc the real preview's walkthrough does. */}
                  <DemoPortalFlow
                    constrained
                    postLoginHtml={config.postLoginHtml}
                    redirectUrl={config.redirectUrl}
                  />
                </PortalRuntimeProvider>
              </div>
            </div>
            <div className="mx-auto h-3 w-full rounded-b-2xl bg-gradient-to-b from-[#312e81] to-[#1e1b4b] shadow-lg" />
            <div className="mx-auto h-1.5 w-24 rounded-b-xl bg-[#1e1b4b]/80" />
          </div>
        ) : (
          <div className="mx-auto max-w-md pt-12">
            <EmptyState
              icon={MonitorSmartphone}
              title="No preview open"
              description={
                'Open this from the "Preview Portal" button on your Portal Settings page.'
              }
            />
          </div>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          A live look at your in-progress guest sign-in screen -- what's shown here is the exact
          same component a real guest's device renders.
        </p>
      </div>
    </div>
  );
}
