import { useState } from "react";
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopNavbar } from "@/components/layout/TopNavbar";
import { QuickActionsFab } from "@/components/system/QuickActionsFab";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { ActivityFeed } from "@/components/activity-feed/ActivityFeed";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    if (context.auth?.status === "anonymous") {
      // This layout also serves Platform Console pages (e.g.
      // /routers/$routerId) that live outside the /master/* route tree
      // but are only ever reached on master.wyfyguest.com -- an
      // unauthenticated visit there (a stale/expired session, or a
      // direct link opened cold) used to unconditionally bounce to
      // /login, the CUSTOMER sign-in form, on the master hostname. Safe
      // to read window here: this route is ssr:false, so beforeLoad only
      // ever runs client-side, no hydration-mismatch risk.
      const isMasterHost = typeof window !== "undefined" && window.location.hostname === "master.wyfyguest.com";
      const loginTarget = isMasterHost ? "/master-login" : "/login";
      // Same defensive guard as authGuards.ts's requireCustomerSession --
      // never carry a redirect target that's already the login page itself
      // forward as the ?redirect= value.
      const isAlreadyOnLoginTarget = location.href === loginTarget || location.href.startsWith(`${loginTarget}?`) || location.href.startsWith(`${loginTarget}#`);
      throw redirect({
        to: loginTarget,
        search: isAlreadyOnLoginTarget ? undefined : { redirect: location.href },
      });
    }
    // Everything this layout renders (customer pages, and the older
    // pre-redesign "Platform Console" pages like /select-space, /locations,
    // /rbac, /marketplace, /routers/$routerId) is visually and functionally
    // distinct from the new Master Console (/master/*, its own separate
    // route tree in master.tsx). On the master.wyfyguest.com hostname none
    // of that old surface should ever render -- not just "no link points
    // there anymore" (links can be fixed one at a time and missed), but a
    // hard guarantee: even a stale bookmark, a typed URL, or the browser
    // back button lands back on the real Master Console instead of the old
    // theme. ssr:false on this route means window is always safe to read
    // here (beforeLoad only runs client-side).
    if (
      typeof window !== "undefined" &&
      window.location.hostname === "master.wyfyguest.com" &&
      !location.pathname.startsWith("/master")
    ) {
      throw redirect({ to: "/master" });
    }
    // The same old surface has a second, worse problem regardless of
    // hostname: AppSidebar renders its full operator "console" nav
    // (WireGuard tunnels, RADIUS, VLAN/DHCP/DNS, White label, Marketplace,
    // an "All organizations" cross-tenant filter, ...) for ANY
    // authenticated user on any of these routes -- the console-vs-workspace
    // sidebar choice in AppSidebar.tsx is keyed purely on pathname
    // (`inWorkspace`), not on the viewer's actual role. `/customer/*` (this
    // layout's real, modern customer surface, with its own CustomerHeader,
    // never AppSidebar) and `/workspace/*` (the older customer-safe
    // surface, already properly gated inside workspace.tsx by
    // legacyRoleBucket) are both fine. Everything else here -- /dashboard,
    // /guests, /account, /notifications, /routers, /locations, /rbac,
    // /marketplace, /select-space -- is the pre-Master-Console operator
    // shell and must never render for a real customer: confirmed live, a
    // real org-owner account with zero global-scope role landed on
    // /dashboard and saw the full internal admin nav and terminology.
    const isOperator = context.auth?.roles?.some((r) => r.scopeType === "global") ?? false;
    const isCustomerSafePath =
      location.pathname === "/c" ||
      location.pathname.startsWith("/c/") ||
      // /customer/$locationId/... still exists as a backward-compat
      // redirect for old bookmarks/shared links predating the /c rename
      // (see customer.$locationId.dashboard.tsx et al) -- still customer-
      // surface territory, not operator-console.
      location.pathname === "/customer" ||
      location.pathname.startsWith("/customer/") ||
      location.pathname === "/workspace" ||
      location.pathname.startsWith("/workspace/") ||
      // Not itself an operator-console page -- a generic tier picker for an
      // account with more than one org/location -- leave its own access
      // logic (multi-org support) alone rather than force everyone through
      // "/" first.
      location.pathname === "/select-space";
    if (context.auth?.status === "authenticated" && !isOperator && !isCustomerSafePath) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { status } = useAuth();
  const [activityOpen, setActivityOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // QuickActionsFab only ever links to platform-only pages (/locations,
  // /routers, /rbac, /marketplace) and duplicates TopNavbar's own
  // workspace-scoped quick actions -- keep it out of the customer
  // workspace entirely rather than teach it a second link set.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inWorkspace = pathname === "/workspace" || pathname.startsWith("/workspace/");

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className={cn("flex min-h-screen w-full", inWorkspace && "workspace-theme")}>
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <TopNavbar onToggleActivityFeed={() => setActivityOpen((v) => !v)} />
          <main className="flex-1 p-3 sm:p-4 lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        {!inWorkspace && <QuickActionsFab />}
      </div>
      <CommandPalette />
      <ActivityFeed open={activityOpen} onOpenChange={setActivityOpen} />
      <OnboardingWizard open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </SidebarProvider>
  );
}
