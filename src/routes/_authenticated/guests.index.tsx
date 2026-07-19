import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuestKpiGrid } from "@/components/guests/GuestKpiGrid";
import { LiveSessionsTable } from "@/components/guests/LiveSessionsTable";
import { GuestAnalytics } from "@/components/guests/GuestAnalytics";
import {
  BlacklistPanel,
  WhitelistPanel,
} from "@/components/guests/AccessListPanels";
import {
  AccessPoliciesPanel,
  LoginMethodsPanel,
} from "@/components/guests/PolicyAndLoginPanels";

export const Route = createFileRoute("/_authenticated/guests/")({
  component: GuestsPage,
});

function GuestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guest WiFi</h1>
          <p className="text-sm text-muted-foreground">
            Monitor live guest sessions, manage access policies, and control who can connect.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Guest list exported")}>
            <Download className="h-4 w-4" /><span className="ml-2">Export guests</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /><span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      <GuestKpiGrid />

      <Tabs defaultValue="sessions">
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="sessions">Live Sessions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="policies">Access Policies</TabsTrigger>
          <TabsTrigger value="login-methods">Login Methods</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
          <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="mt-4">
          <LiveSessionsTable />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <GuestAnalytics />
        </TabsContent>
        <TabsContent value="policies" className="mt-4">
          <AccessPoliciesPanel />
        </TabsContent>
        <TabsContent value="login-methods" className="mt-4">
          <LoginMethodsPanel />
        </TabsContent>
        <TabsContent value="blacklist" className="mt-4">
          <BlacklistPanel />
        </TabsContent>
        <TabsContent value="whitelist" className="mt-4">
          <WhitelistPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
