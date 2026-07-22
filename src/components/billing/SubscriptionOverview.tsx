import { useState } from "react";
import { CreditCard, Download, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const CURRENT_PLAN = {
  name: "Enterprise",
  status: "active" as const,
  price: "$1,299",
  period: "monthly",
  nextBilling: "Aug 15, 2025",
  renews: "auto",
  features: [
    { name: "Locations", used: 8, limit: 25 },
    { name: "Routers", used: 12, limit: 50 },
    { name: "Active users", used: 456, limit: 2000 },
    { name: "Storage", used: 45, limit: 100, unit: "GB" },
    { name: "SMS credits", used: 1200, limit: 5000 },
  ],
};

export function SubscriptionOverview() {
  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-start justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{CURRENT_PLAN.name}</CardTitle>
              <Badge className="bg-emerald-500/15 text-emerald-600 capitalize">active</Badge>
              <Badge variant="outline" className="capitalize">{CURRENT_PLAN.period}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Your subscription renews {CURRENT_PLAN.renews} on <strong>{CURRENT_PLAN.nextBilling}</strong>
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{CURRENT_PLAN.price}</p>
            <p className="text-xs text-muted-foreground">per {CURRENT_PLAN.period}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {CURRENT_PLAN.features.map((f) => (
            <div key={f.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{f.name}</span>
                <span className="text-muted-foreground">
                  {f.used}/{f.limit}{f.unit ? ` ${f.unit}` : ""}
                </span>
              </div>
              <Progress value={(f.used / f.limit) * 100} className={cn(
                "h-2",
                (f.used / f.limit) > 0.8 ? "[&>div]:bg-amber-500" :
                (f.used / f.limit) > 0.95 ? "[&>div]:bg-rose-500" : ""
              )} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1">
          <Download className="mr-2 h-4 w-4" /> Download invoice
        </Button>
        <Button size="sm" variant="outline" className="flex-1">
          <Calendar className="mr-2 h-4 w-4" /> Change plan
        </Button>
        <Button size="sm" variant="outline" className="flex-1">
          <CreditCard className="mr-2 h-4 w-4" /> Update payment
        </Button>
      </div>
    </div>
  );
}
