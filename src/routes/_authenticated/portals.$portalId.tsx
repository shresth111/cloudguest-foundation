import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  Loader2,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PortalStatusBadge, LoginMethodBadge } from "@/components/portals/PortalBadges";
import { PortalBuilder } from "@/components/portals/PortalBuilder";
import { PortalCustomization } from "@/components/portals/PortalCustomization";
import { PortalThemes } from "@/components/portals/PortalThemes";
import {
  PortalLoginSettingsPanel,
  PortalSeoPanel,
  PortalLanguagesPanel,
} from "@/components/portals/PortalSettingsPanels";
import { PortalQrPanel, PortalAdsPanel } from "@/components/portals/PortalQrAndAds";
import { PortalAnalytics } from "@/components/portals/PortalAnalytics";
import { PortalVersionHistory } from "@/components/portals/PortalVersionHistory";
import { PortalLivePreview } from "@/components/portals/PortalLivePreview";
import {
  useDuplicatePortal,
  usePortal,
  useSetPortalStatus,
  useUpdatePortal,
} from "@/hooks/usePortals";
import type { Portal } from "@/types/portal";

export const Route = createFileRoute("/_authenticated/portals/$portalId")({
  component: PortalDetailPage,
});

function PortalDetailPage() {
  const { portalId } = useParams({ from: "/_authenticated/portals/$portalId" });
  const { data, isLoading, isError, refetch } = usePortal(portalId);
  const update = useUpdatePortal(portalId);
  const publish = useSetPortalStatus();
  const duplicate = useDuplicatePortal();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const patch = (p: Partial<Portal>) => update.mutate(p);

  const downloadHtml = () => {
    const html = `<!doctype html><html><head><title>${data.seo.pageTitle}</title></head><body><h1>${data.name}</h1><p>Preview export placeholder</p></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.id}.html`;
    a.click();
    toast.success("HTML preview downloaded");
  };

  const resetDesign = () => {
    patch({
      components: [
        { id: Math.random().toString(36).slice(2, 10), type: "logo", props: { align: "center", size: 96 } },
        { id: Math.random().toString(36).slice(2, 10), type: "heading", props: { text: "Welcome" } },
        { id: Math.random().toString(36).slice(2, 10), type: "login_card", props: {} },
        { id: Math.random().toString(36).slice(2, 10), type: "footer", props: { text: "Powered by CloudGuest" } },
      ],
    });
    toast.success("Design reset to defaults");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link to="/portals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to portals
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <PortalStatusBadge status={data.status} />
            <LoginMethodBadge method={data.primaryLoginMethod} />
          </div>
          <p className="text-sm text-muted-foreground">
            {data.organizationName} · {data.locationName} · v{data.currentVersion} ·
            {" "}Updated {new Date(data.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          <Button size="sm" variant="outline" onClick={() => patch({ status: "draft" })}>
            <Save className="mr-2 h-4 w-4" /> Save draft
          </Button>
          {data.status === "published" ? (
            <Button size="sm" variant="outline" onClick={() => publish.mutate({ id: data.id, status: "draft" })}>
              Unpublish
            </Button>
          ) : (
            <Button size="sm" onClick={() => publish.mutate({ id: data.id, status: "published" })}>
              {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Publish
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => duplicate.mutate(data.id)}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </Button>
          <Button size="sm" variant="outline" onClick={downloadHtml}>
            <Download className="mr-2 h-4 w-4" /> Download HTML
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset design
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <MetricTile label="Views" value={data.views.toLocaleString()} />
          <MetricTile label="Logins" value={data.logins.toLocaleString()} />
          <MetricTile label="Conversion" value={`${((data.logins / Math.max(1, data.views)) * 100).toFixed(1)}%`} />
          <MetricTile label="Languages" value={`${data.languages.length}`} hint={data.languages.map((l) => l.toUpperCase()).join(", ")} />
        </CardContent>
      </Card>

      <Tabs defaultValue="builder">
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="settings">Login settings</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="qr">QR</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-4">
          <PortalBuilder portal={data} onChange={patch} />
        </TabsContent>
        <TabsContent value="design" className="mt-4">
          <PortalCustomization portal={data} onChange={patch} />
        </TabsContent>
        <TabsContent value="themes" className="mt-4">
          <PortalThemes portal={data} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <PortalLoginSettingsPanel portal={data} />
        </TabsContent>
        <TabsContent value="languages" className="mt-4">
          <PortalLanguagesPanel portal={data} />
        </TabsContent>
        <TabsContent value="qr" className="mt-4">
          <PortalQrPanel portal={data} />
        </TabsContent>
        <TabsContent value="ads" className="mt-4">
          <PortalAdsPanel portal={data} />
        </TabsContent>
        <TabsContent value="seo" className="mt-4">
          <PortalSeoPanel portal={data} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <PortalAnalytics portalId={data.id} />
        </TabsContent>
        <TabsContent value="versions" className="mt-4">
          <PortalVersionHistory portal={data} />
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Live preview</DialogTitle></DialogHeader>
          <PortalLivePreview portal={data} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset design?"
        description="This restores the portal to a minimal default layout. You can restore any prior version from the Versions tab."
        destructive
        confirmLabel="Reset"
        onConfirm={() => { resetDesign(); setConfirmReset(false); }}
      />
    </div>
  );
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
