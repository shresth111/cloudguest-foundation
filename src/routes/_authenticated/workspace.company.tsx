import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/context/WorkspaceContext";

export const Route = createFileRoute("/_authenticated/workspace/company")({
  component: CompanyPage,
});

const TABS = [
  "Overview",
  "Company",
  "Business",
  "Locations",
  "Subscription",
  "Billing",
  "Feature access",
  "API keys",
  "Branding",
  "Audit",
];

function CompanyPage() {
  const { customer, locations } = useWorkspace();
  if (!customer) return null;
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Company settings</h1>
      <Tabs defaultValue="Overview">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max min-w-full flex-nowrap">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="whitespace-nowrap">
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="Overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{customer.name}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Organization" value={customer.organizationName} />
              <Field label="Owner" value={customer.owner.name} />
              <Field label="Owner email" value={customer.owner.email} />
              <Field label="Locations" value={String(locations.length)} />
              <Field label="Plan" value={customer.subscription.plan} />
              <Field label="Status" value={customer.status} />
            </CardContent>
          </Card>
        </TabsContent>
        {TABS.filter((t) => t !== "Overview").map((t) => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t}</CardTitle>
              </CardHeader>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t} configuration for {customer.name}.
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}
