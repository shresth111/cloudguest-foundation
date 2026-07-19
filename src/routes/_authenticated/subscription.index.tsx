import { createFileRoute } from "@tanstack/react-router";
import { Download, Sparkles, ArrowUpRight, RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useInvoices, usePlan, useSystemMetrics } from "@/hooks/useSystem";

export const Route = createFileRoute("/_authenticated/subscription/")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const plan = usePlan();
  const invoices = useInvoices();
  const metrics = useSystemMetrics();

  if (plan.isLoading || invoices.isLoading) return <PageSkeleton />;
  if (plan.isError || !plan.data) return <ErrorState onRetry={() => plan.refetch()} />;

  const p = plan.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription center"
        description="Manage your plan, monitor usage, and download invoices."
        actions={
          <>
            <Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Renew</Button>
            <Button><ArrowUpRight className="mr-2 h-4 w-4" />Upgrade plan</Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
              <CardTitle className="mt-1 flex items-center gap-2 text-2xl">
                {p.tier}
                <Sparkles className="h-5 w-5 text-primary" />
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                ${p.price.toLocaleString()} / {p.cycle} · Renews {new Date(p.renewsOn).toLocaleDateString()}
              </p>
            </div>
            <Badge variant="outline" className="capitalize">{p.cycle}</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {p.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {f}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="font-medium">Visa •••• 4242</p>
              <p className="text-xs text-muted-foreground">Expires 09/2028 · Auto-charged</p>
            </div>
            <Button variant="outline" className="w-full">Update card</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage this billing cycle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {p.usage.map((u) => {
            const pct = Math.round((u.used / u.limit) * 100);
            return (
              <div key={u.key} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{u.label}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <Progress value={pct} className="mt-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {u.used.toLocaleString()} / {u.limit.toLocaleString()} {u.unit}
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
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                <Area type="monotone" dataKey="requests" stroke="hsl(var(--primary))" fill="url(#req)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Invoices</CardTitle>
          <Button variant="outline" size="sm" onClick={() => toast.success("Statement queued")}>
            <Download className="mr-2 h-4 w-4" />Export
          </Button>
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
                {invoices.data?.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-sm">{i.number}</TableCell>
                    <TableCell>${i.amount.toLocaleString()} {i.currency}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(i.issuedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(i.dueAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {i.status === "paid" && <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Paid</Badge>}
                      {i.status === "open" && <Badge className="bg-sky-500/15 text-sky-600 hover:bg-sky-500/20">Open</Badge>}
                      {i.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => toast.success(`Invoice ${i.number} downloaded`)}>
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
