import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/WorkspaceContext";

export const Route = createFileRoute("/_authenticated/workspace/company")({
  component: CompanyPage,
});

function CompanyPage() {
  const { customer, locations } = useWorkspace();
  if (!customer) return null;

  // Only the fields that come from the organization row itself. This page
  // used to carry ten tabs of which nine rendered the literal string
  // "<tab> configuration for <org>" -- a fully clickable navigation where
  // every destination was a dead end. The three that have a real screen are
  // linked below; the rest were never built.
  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Company</h1>
        <p className="text-sm text-muted-foreground">
          Your organization&apos;s details as they appear on invoices and guest portals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{customer.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Organization" value={customer.organizationName} />
          <Field label="Contact email" value={customer.owner.email} />
          <Field label="Locations" value={String(locations.length)} />
          <Field label="Status" value={customer.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Elsewhere in your workspace</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="w-full justify-between">
            <Link to="/workspace/locations">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Locations ({locations.length})
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-between">
            <Link to="/workspace/billing">
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Plan &amp; invoices
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize">{value || "—"}</p>
    </div>
  );
}
