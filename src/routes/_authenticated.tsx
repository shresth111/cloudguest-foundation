import { useState } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { status } = useAuth();
  const [activityOpen, setActivityOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <TopNavbar onToggleActivityFeed={() => setActivityOpen((v) => !v)} />
          <main className="flex-1 p-3 sm:p-4 lg:p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <QuickActionsFab />
      </div>
      <CommandPalette />
      <ActivityFeed open={activityOpen} onOpenChange={setActivityOpen} />
      <OnboardingWizard open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </SidebarProvider>
  );
}
