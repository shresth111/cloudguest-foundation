import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDownloadInvoice, useMyBillingDashboard } from "@/hooks/useBilling";

export const Route = createFileRoute("/_authenticated/workspace/billing")({
  component: BillingPage,
});

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function BillingPage() {
  const { customer } = useWorkspace();
  const billing = useMyBillingDashboard(customer?.organizationId, customer?.organizationName);
  const download = useDownloadInvoice();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!customer) return null;

  function handleDownload(invoiceId: string, invoiceNumber: string) {
    setDownloadingId(invoiceId);
    download.mutate(invoiceId, {
      onSuccess: ({ url, fileName }) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        toast.success(`Downloading ${invoiceNumber}`);
      },
      onError: () => toast.error("Could not download the invoice PDF."),
      onSettled: () => setDownloadingId(null),
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>

      {billing.isLoading ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : billing.isError || !billing.data ? (
        <ErrorState onRetry={() => billing.refetch()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current subscription</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric label="Plan" value={billing.data.plan.name} />
            <Metric label="Cycle" value={billing.data.billingCycle} />
            <Metric
              label={billing.data.status === "active" ? "Renewal" : "Ends"}
              value={new Date(billing.data.renewalDate).toLocaleDateString()}
            />
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge className="mt-1 capitalize">{billing.data.status.replace("_", " ")}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Recent invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {billing.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : billing.data && billing.data.recentInvoices.length > 0 ? (
            <ul className="divide-y">
              {billing.data.recentInvoices.map((inv) => (
                <li
                  key={inv.id}
                  className="grid grid-cols-2 items-center gap-2 py-3 text-sm sm:grid-cols-4"
                >
                  <span className="font-mono">{inv.invoiceNumber}</span>
                  <span className="text-muted-foreground sm:text-left">
                    {new Date(inv.issuedAt).toLocaleDateString()}
                  </span>
                  <span className="font-semibold">
                    {money(inv.total, billing.data.plan.currency)}
                  </span>
                  <div className="flex items-center justify-self-end gap-2">
                    <Badge
                      variant={
                        inv.status === "pending"
                          ? "secondary"
                          : inv.status === "failed"
                            ? "destructive"
                            : "default"
                      }
                    >
                      {inv.status === "pending"
                        ? "Pending"
                        : inv.status === "failed"
                          ? "Failed"
                          : inv.status === "refunded"
                            ? "Refunded"
                            : "Paid"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={downloadingId === inv.id}
                      onClick={() => handleDownload(inv.id, inv.invoiceNumber)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No invoices yet.</p>
          )}
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
