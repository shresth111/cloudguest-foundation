import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/context/WorkspaceContext";

export const Route = createFileRoute("/_authenticated/workspace/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { customer } = useWorkspace();
  if (!customer) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current subscription</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="Plan" value={customer.subscription.plan} />
          <Metric label="Cycle" value={customer.subscription.billingCycle} />
          <Metric
            label="Renewal"
            value={new Date(customer.subscription.expiryDate).toLocaleDateString()}
          />

          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className="mt-1 capitalize">{customer.subscription.status}</Badge>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent invoices</CardTitle>
          <Button variant="outline" size="sm">
            Download all
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center justify-between py-3 text-sm">
                <span className="font-mono">INV-{2025000 + i}</span>
                <span className="text-muted-foreground">
                  {new Date(Date.now() - i * 30 * 86400000).toLocaleDateString()}
                </span>
                <span className="font-semibold">${(customer.subscription.plan === "enterprise" ? 899 : 299).toLocaleString()}</span>
                <Badge variant={i === 0 ? "secondary" : "default"}>
                  {i === 0 ? "Pending" : "Paid"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}
