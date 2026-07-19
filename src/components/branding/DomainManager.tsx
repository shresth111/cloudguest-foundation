import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Globe, Plus, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { domainSchema, type DomainFormValues } from "@/lib/branding-schemas";
import { useAddDomain, useRemoveDomain, useVerifyDomain } from "@/hooks/useBranding";
import type { Brand, CustomDomain } from "@/types/branding";

const badge = (state: "issued" | "verified" | "active" | "pending" | "verifying" | "failed") => {
  const map = {
    issued: { v: "default", label: "Issued" },
    verified: { v: "default", label: "Verified" },
    active: { v: "default", label: "Active" },
    pending: { v: "secondary", label: "Pending" },
    verifying: { v: "secondary", label: "Verifying" },
    failed: { v: "destructive", label: "Failed" },
  } as const;
  const m = map[state];
  return <Badge variant={m.v}>{m.label}</Badge>;
};

export function DomainManager({ brand, domain }: { brand: Brand; domain?: CustomDomain }) {
  const add = useAddDomain();
  const verify = useVerifyDomain();
  const remove = useRemoveDomain();
  const [removing, setRemoving] = useState(false);

  const form = useForm<DomainFormValues>({ resolver: zodResolver(domainSchema), defaultValues: { domain: "" } });

  const onSubmit = (v: DomainFormValues) => {
    add.mutate({ brandId: brand.id, domain: v.domain }, {
      onSuccess: () => { toast.success("Domain added — verify DNS to activate"); form.reset(); },
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Custom domain</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {domain ? (
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Globe className="h-5 w-5" /></div>
                  <div>
                    <div className="font-mono text-sm">{domain.domain}</div>
                    <div className="text-xs text-muted-foreground">Added {new Date(domain.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => verify.mutate(domain.id, { onSuccess: () => toast.success("Domain verified") })}>
                    <ShieldCheck className="mr-1.5 h-4 w-4" /> Verify
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(true)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatusRow icon={ShieldCheck} label="SSL certificate" state={domain.ssl} />
                <StatusRow icon={CheckCircle2} label="DNS records" state={domain.dns} />
                <StatusRow icon={XCircle} label="Verification" state={domain.verification} />
              </div>
              <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs">
                <div className="font-medium">DNS records to add</div>
                <div className="mt-2 font-mono text-[11px] leading-relaxed">
                  A     @        → 185.158.133.1<br />
                  CNAME www      → {domain.domain}<br />
                  TXT   _cg      → cg-verify=abc123
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={Globe} title="No custom domain" description="Add a domain to serve the portal and admin dashboard under your brand." />
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs">Add a new domain</Label>
              <Input className="mt-1" placeholder="wifi.brandname.com" {...form.register("domain")} />
              {form.formState.errors.domain && <p className="mt-1 text-xs text-destructive">{form.formState.errors.domain.message}</p>}
            </div>
            <Button type="submit" disabled={add.isPending}><Plus className="mr-1.5 h-4 w-4" /> Add domain</Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`Remove ${domain?.domain}?`}
        description="Guests will no longer reach the portal at this domain."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (!domain) return;
          remove.mutate(domain.id, { onSuccess: () => toast.success("Domain removed") });
          setRemoving(false);
        }}
      />
    </>
  );
}

function StatusRow({ icon: Icon, label, state }: { icon: typeof Globe; label: string; state: "issued" | "verified" | "active" | "pending" | "verifying" | "failed" }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2.5">
      <div className="flex items-center gap-2 text-xs"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</div>
      {badge(state)}
    </div>
  );
}
