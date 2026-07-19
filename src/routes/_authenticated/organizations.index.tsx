import { createFileRoute } from "@tanstack/react-router";
import { OrganizationTable } from "@/components/organizations/OrganizationTable";

export const Route = createFileRoute("/_authenticated/organizations/")({
  component: OrganizationsListPage,
});

function OrganizationsListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Manage tenants, subscriptions and access across the CloudGuest platform.
        </p>
      </div>
      <OrganizationTable />
    </div>
  );
}
