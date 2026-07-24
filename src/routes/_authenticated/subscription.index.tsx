import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Sparkles, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuth } from "@/context/AuthContext";
import { useDownloadInvoice, useMyBillingDashboard } from "@/hooks/useBilling";
import { useSystemMetrics } from "@/hooks/useSystem";

export const Route = createFileRoute("/_authenticated/subscription/")({
  component: SubscriptionPage,
});

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function SubscriptionPage() {
  const { organizations } = useAuth();
  const activeOrg = organizations[0];
  const billing = useMyBillingDashboard(activeOrg?.organizationId, activeOrg?.organizationName);
  const metrics = useSystemMetrics();
  const download = useDownloadInvoice();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (billing.isLoading) return <PageSkeleton />;
  if (billing.isError || !billing.data) return <ErrorState onRetry={() => billing.refetch()} />;

  const { plan, billingCycle, status, renewalDate, autoRenewal, usage, recentInvoices } =
    billing.data;
  const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;

  function handleDownload(invoiceId: string, invoiceNumber: string) {
    setDownloadingId(invoiceId);
    download.mutate(invoiceId, {
      onSuccess: ({ url, fileName }) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        toast.success(`Downloading ${invoiceNumber} (GST invoice PDF)`);
      },
      onError: () => toast.error("Could not download the invoice PDF."),
      onSettled: () => setDownloadingId(null),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription center"
        description="Your plan, usage, and invoices for this organization."
        actions={
          <Button variant="outline" onClick={() => billing.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
              <CardTitle className="mt-1 flex items-center gap-2 text-2xl capitalize">
                {plan.name}
                <Sparkles className="h-5 w-5 text-primary" />
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {money(price, plan.currency)} / {billingCycle} ·{" "}
                {status === "active" ? "Renews" : "Ends"}{" "}
                {new Date(renewalDate).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className="capitalize">
                {billingCycle}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {autoRenewal ? "Auto-renew on" : "Auto-renew off"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {plan.includedLocations}{" "}
                locations
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {plan.includedRouters}{" "}
                routers
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />{" "}
                {plan.includedGuests.toLocaleString()} guests / mo
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {plan.storageLimitGb} GB
                storage
              </div>
              {plan.apiAccess && (
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> API access
                </div>
              )}
              {plan.whiteLabel && (
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> White label
                </div>
              )}
              {plan.pmsIntegration && (
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> PMS integration
                </div>
              )}
              {plan.aiFeatures && (
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> AI features
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="font-medium capitalize">{status.replace("_", " ")}</p>
              <p className="text-xs text-muted-foreground">
                To change plans or billing settings, contact your account owner or CloudGuest
                support.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage this billing cycle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {usage.map((u) => {
            const pct = u.limit > 0 ? Math.round((u.used / u.limit) * 100) : 0;
            return (
              <div key={u.key} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{u.label}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="mt-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {u.used.toLocaleString()} / {u.limit.toLocaleString()} {u.unit ?? ""}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {metrics.data && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">API usage (24h)</CardTitle>
            <span className="text-xs text-muted-foreground">Auto-refreshed</span>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.data}>
                <defs>
                  <linearGradient id="req" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="hsl(var(--primary))"
                  fill="url(#req)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentInvoices.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-6"
                    >
                      No invoices yet.
                    </TableCell>
                  </TableRow>
                )}
                {recentInvoices.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-sm">{i.invoiceNumber}</TableCell>
                    <TableCell>{money(i.total, plan.currency)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(i.issuedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(i.dueAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {i.status === "paid" && (
                        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">
                          Paid
                        </Badge>
                      )}
                      {i.status === "pending" && (
                        <Badge className="bg-sky-500/15 text-sky-600 hover:bg-sky-500/20">
                          Pending
                        </Badge>
                      )}
                      {i.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                      {i.status === "refunded" && <Badge variant="secondary">Refunded</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={downloadingId === i.id}
                        onClick={() => handleDownload(i.id, i.invoiceNumber)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
