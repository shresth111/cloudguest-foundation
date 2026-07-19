import { Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard, FieldGrid } from "../SectionCard";
import type { LicenseInfo } from "@/types/settings";

export function LicensePanel({ data }: { data: LicenseInfo }) {
  const daysLeft = Math.max(0, Math.round((new Date(data.expiryDate).getTime() - Date.now()) / 86_400_000));
  const copy = () => { void navigator.clipboard.writeText(data.licenseKey); toast.success("License key copied"); };

  return (
    <SectionCard
      title="License"
      description="Plan entitlements and activation details."
    >
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            {data.plan.toUpperCase()} plan
            <Badge variant={daysLeft > 30 ? "secondary" : "destructive"}>Expires in {daysLeft}d</Badge>
          </div>
          <code className="mt-1 block truncate font-mono text-xs text-muted-foreground">{data.licenseKey}</code>
        </div>
        <Button size="sm" variant="outline" onClick={copy}><Copy className="mr-2 h-4 w-4" /> Copy key</Button>
      </div>

      <FieldGrid>
        <Info label="Organization limit" value={data.organizationLimit.toLocaleString()} />
        <Info label="Router limit" value={data.routerLimit.toLocaleString()} />
        <Info label="Guest limit" value={data.guestLimit.toLocaleString()} />
        <Info label="Expiry date" value={new Date(data.expiryDate).toLocaleDateString()} />
      </FieldGrid>

      <div>
        <div className="mb-2 text-xs font-medium text-muted-foreground">Activated features</div>
        <div className="flex flex-wrap gap-2">
          {data.activatedFeatures.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}
        </div>
      </div>
    </SectionCard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
