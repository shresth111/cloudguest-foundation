import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WhiteLabelKpiGrid } from "@/components/branding/WhiteLabelKpiGrid";
import { BrandTable } from "@/components/branding/BrandTable";
import { LivePreview } from "@/components/branding/LivePreview";
import { BrandSettingsPanel } from "@/components/branding/BrandSettingsPanel";
import { ColorManagementPanel } from "@/components/branding/ColorManagementPanel";
import { TypographyPanel } from "@/components/branding/TypographyPanel";
import { LoginBrandingPanel } from "@/components/branding/LoginBrandingPanel";
import { DomainManager } from "@/components/branding/DomainManager";
import { EmailBrandingPanel } from "@/components/branding/EmailBrandingPanel";
import { SmsBrandingPanel } from "@/components/branding/SmsBrandingPanel";
import { PortalBrandingPanel } from "@/components/branding/PortalBrandingPanel";
import { BrandingTemplatesGallery } from "@/components/branding/BrandingTemplatesGallery";
import { BrandingQuickActions } from "@/components/branding/BrandingQuickActions";
import { useBrandingSnapshot, usePublishBrand } from "@/hooks/useBranding";

export const Route = createFileRoute("/_authenticated/branding/")({
  component: BrandingPage,
});

type PreviewVariant = "dashboard" | "login" | "portal";

function BrandingPage() {
  const [tab, setTab] = useState("brands");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [preview, setPreview] = useState<PreviewVariant>("dashboard");
  const qc = useQueryClient();
  const snap = useBrandingSnapshot();
  const publish = usePublishBrand();

  useEffect(() => {
    if (!selectedId && snap.data?.brands.length) setSelectedId(snap.data.brands[0].id);
  }, [snap.data?.brands, selectedId]);

  const brand = useMemo(() => snap.data?.brands.find((b) => b.id === selectedId), [snap.data?.brands, selectedId]);
  const domain = useMemo(() => snap.data?.domains.find((d) => d.brandId === selectedId), [snap.data?.domains, selectedId]);

  const state = { isLoading: snap.isLoading, isError: snap.isError, onRetry: () => snap.refetch() };
  const refresh = () => { qc.invalidateQueries({ queryKey: ["branding"] }); toast.success("Branding refreshed"); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">White label & branding</h1>
          <p className="text-sm text-muted-foreground">Manage brands, themes, domains and messaging across the platform.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {brand && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {snap.data?.brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          {brand && (
            <Button size="sm" onClick={() => publish.mutate(brand.id, { onSuccess: () => toast.success("Brand published") })}>
              <Rocket className="mr-2 h-4 w-4" /> Publish
            </Button>
          )}
        </div>
      </div>

      <WhiteLabelKpiGrid data={snap.data?.kpis} {...state} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="settings" disabled={!brand}>Settings</TabsTrigger>
          <TabsTrigger value="colors" disabled={!brand}>Colors</TabsTrigger>
          <TabsTrigger value="typography" disabled={!brand}>Typography</TabsTrigger>
          <TabsTrigger value="login" disabled={!brand}>Login</TabsTrigger>
          <TabsTrigger value="domain" disabled={!brand}>Domain</TabsTrigger>
          <TabsTrigger value="email" disabled={!brand}>Email</TabsTrigger>
          <TabsTrigger value="sms" disabled={!brand}>SMS</TabsTrigger>
          <TabsTrigger value="portal" disabled={!brand}>Portal</TabsTrigger>
          <TabsTrigger value="templates" disabled={!brand}>Templates</TabsTrigger>
          <TabsTrigger value="preview" disabled={!brand}>Live preview</TabsTrigger>
        </TabsList>

        <TabsContent value="brands" className="mt-4">
          <BrandTable
            data={snap.data?.brands}
            domains={snap.data?.domains}
            {...state}
            selectedId={selectedId}
            onSelect={(id) => { setSelectedId(id); setTab("settings"); }}
          />
        </TabsContent>

        {brand && (
          <>
            <TabsContent value="settings" className="mt-4 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                <BrandSettingsPanel brand={brand} />
                <BrandingQuickActions brand={brand} />
              </div>
            </TabsContent>

            <TabsContent value="colors" className="mt-4 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
                <ColorManagementPanel brand={brand} />
                <LivePreview brand={brand} variant="dashboard" />
              </div>
            </TabsContent>

            <TabsContent value="typography" className="mt-4 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
                <TypographyPanel brand={brand} />
                <LivePreview brand={brand} variant="dashboard" />
              </div>
            </TabsContent>

            <TabsContent value="login" className="mt-4 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
                <LoginBrandingPanel brand={brand} />
                <LivePreview brand={brand} variant="login" />
              </div>
            </TabsContent>

            <TabsContent value="domain" className="mt-4">
              <DomainManager brand={brand} domain={domain} />
            </TabsContent>

            <TabsContent value="email" className="mt-4">
              <EmailBrandingPanel brand={brand} />
            </TabsContent>

            <TabsContent value="sms" className="mt-4">
              <SmsBrandingPanel brand={brand} />
            </TabsContent>

            <TabsContent value="portal" className="mt-4 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
                <PortalBrandingPanel brand={brand} />
                <LivePreview brand={brand} variant="portal" />
              </div>
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              <BrandingTemplatesGallery brand={brand} templates={snap.data?.templates ?? []} />
            </TabsContent>

            <TabsContent value="preview" className="mt-4 space-y-4">
              <Card>
                <CardContent className="flex flex-wrap items-center gap-2 p-3">
                  <span className="text-xs text-muted-foreground">Surface:</span>
                  {(["dashboard", "login", "portal"] as const).map((v) => (
                    <Button key={v} size="sm" variant={preview === v ? "default" : "outline"} className="capitalize" onClick={() => setPreview(v)}>{v}</Button>
                  ))}
                </CardContent>
              </Card>
              <LivePreview brand={brand} variant={preview} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
