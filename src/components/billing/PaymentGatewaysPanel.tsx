import { toast } from "sonner";
import { CreditCard, Wallet, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useToggleGateway } from "@/hooks/useBilling";
import type { PaymentGateway, PaymentGatewayConfig } from "@/types/billing";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const ICONS: Record<PaymentGateway, typeof CreditCard> = {
  stripe: CreditCard,
  razorpay: Zap,
  paypal: Wallet,
};

interface Props {
  data?: PaymentGatewayConfig[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function PaymentGatewaysPanel({ data, isLoading, isError, onRetry }: Props) {
  const toggle = useToggleGateway();
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={onRetry} />;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {data.map((g) => {
        const Icon = ICONS[g.id];
        return (
          <Card key={g.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                <CardTitle className="text-base">{g.name}</CardTitle>
              </div>
              <Badge variant={g.connected ? "default" : "outline"}>{g.connected ? "Connected" : "Not connected"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">Mode: <span className="uppercase font-medium text-foreground">{g.mode}</span></div>
              <div className="text-xs text-muted-foreground">
                Last transaction: {g.lastTransactionAt ? dateFmt.format(new Date(g.lastTransactionAt)) : "—"}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <span className="text-sm">Enabled</span>
                <Switch
                  checked={g.connected}
                  onCheckedChange={() => toggle.mutate(g.id, { onSuccess: () => toast.success(`${g.name} ${g.connected ? "disabled" : "enabled"}`) })}
                />
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => toast.info(`${g.name} settings opened`)}>Configure</Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
