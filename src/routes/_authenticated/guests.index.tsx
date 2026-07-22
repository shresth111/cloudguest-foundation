import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuestKpiGrid } from "@/components/guests/GuestKpiGrid";
import { LiveSessionsTable } from "@/components/guests/LiveSessionsTable";
import { GuestAnalytics } from "@/components/guests/GuestAnalytics";
import { GuestListTable } from "@/components/guests/GuestListTable";
import { AccessRulesPanel } from "@/components/guests/AccessRulesPanel";
import { GuestTeamsPanel } from "@/components/guests/GuestTeamsPanel";

export const Route = createFileRoute("/_authenticated/guests/")({
  component: GuestsPage,
});

function GuestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guest WiFi</h1>
        <p className="text-sm text-muted-foreground">
          Monitor guest sessions, manage access rules and teams, and control who can connect.
        </p>
      </div>

      <GuestKpiGrid />

      <Tabs defaultValue="guests">
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="guests">Guests</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="access-rules">Access Rules</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="guests" className="mt-4">
          <GuestListTable />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <LiveSessionsTable />
        </TabsContent>
        <TabsContent value="access-rules" className="mt-4">
          <AccessRulesPanel />
        </TabsContent>
        <TabsContent value="teams" className="mt-4">
          <GuestTeamsPanel />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <GuestAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
