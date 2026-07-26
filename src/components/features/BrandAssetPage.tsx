import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { brandAssetService } from "@/services/brand-asset.service";
import type { AppError } from "@/services/api";

const DEMO_UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

interface DemoAsset { businessUnit: string; url: string; }

const BRANDING_QUERY_KEY = ["branding", "current-organization"] as const;

export default function BrandAssetPage({ title, description, tableTitle, tableSubtitle, aspect }: { title: string; description: string; tableTitle: string; tableSubtitle: string; aspect: "wide" | "square" }) {
  const demo = useIsDemo();
  return demo
    ? <DemoBrandAssetPage title={title} description={description} tableTitle={tableTitle} tableSubtitle={tableSubtitle} aspect={aspect} />
    : <RealBrandAssetPage title={title} description={description} tableTitle={tableTitle} tableSubtitle={tableSubtitle} aspect={aspect} />;
}

/**
 * Real mode: wired to the backend's org-scoped branding endpoints
 * (see src/services/brand-asset.service.ts). There is no per-location
 * concept on the backend -- the `brandings` table is one row per
 * organization -- so unlike demo mode this doesn't offer a per-business-
 * unit picker; it manages the one background image the whole organization
 * shares (the login screen doesn't know which location a guest belongs to
 * until after they've connected).
 *
 * "Live preview" has two distinct meanings, both handled here:
 *  - Before save: `URL.createObjectURL(file)` on the just-picked local
 *    file -- a real, standard use of that API for a not-yet-uploaded
 *    preview. Revoked on cleanup so it never leaks.
 *  - After save: the actual persisted image, re-fetched by `useQuery` from
 *    `GET /branding/background-image/raw` (via a local blob URL, since an
 *    `<img>` tag can't send the auth headers that endpoint needs -- see
 *    brand-asset.service.ts's own note on this) -- not the local
 *    pre-upload blob URL. A full page reload re-fetches this from the
 *    server, not from stale local state.
 */
function RealBrandAssetPage({ title, description, tableTitle, tableSubtitle, aspect }: { title: string; description: string; tableTitle: string; tableSubtitle: string; aspect: "wide" | "square" }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: branding, isLoading, isError } = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: () => brandAssetService.getBranding(),
  });

  // The persisted image itself -- fetched separately from GET /branding,
  // which only reports whether one exists (`hasBackgroundImage`), not the
  // bytes. Deliberately a plain effect, not a second `useQuery` keyed off
  // `branding.updatedAt`: a dependent query re-mounted via
  // invalidateQueries/removeQueries after the delete mutation raced its
  // own stale `enabled` snapshot from *before* `hasBackgroundImage`
  // flipped to false, firing one real (harmless but not clean) 404
  // request against the now-empty endpoint -- confirmed live. A `useEffect`
  // only ever runs after React has actually committed the new
  // `branding` value, so it can't observe that stale, pre-mutation state.
  const [currentImageBlobUrl, setCurrentImageBlobUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  useEffect(() => {
    if (!branding?.hasBackgroundImage) {
      setCurrentImageBlobUrl(null);
      return;
    }
    let cancelled = false;
    setIsImageLoading(true);
    brandAssetService.fetchBackgroundImageBlobUrl().then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      setCurrentImageBlobUrl(url);
      setIsImageLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding?.hasBackgroundImage, branding?.updatedAt]);

  // Blob URLs are never revoked by the browser on their own -- revoke the
  // previous one whenever a new one replaces it (including on unmount).
  useEffect(() => {
    return () => { if (currentImageBlobUrl) URL.revokeObjectURL(currentImageBlobUrl); };
  }, [currentImageBlobUrl]);

  // Local, pre-upload preview only -- revoked whenever the selected file
  // changes or the component unmounts, so it never outlives its use.
  useEffect(() => {
    if (!file) { setLocalPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const refreshBranding = () => qc.invalidateQueries({ queryKey: BRANDING_QUERY_KEY });

  const uploadMutation = useMutation({
    mutationFn: (f: File) => brandAssetService.uploadBackgroundImage(f),
    onSuccess: () => {
      refreshBranding();
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(`${title} updated.`);
    },
    // The shared `api` instance's response interceptor (src/services/api.ts)
    // already converts a failed axios request into an AppError before this
    // rejection reaches react-query -- no need to re-derive it here.
    onError: (err) => toast.error((err as unknown as AppError).message || "Upload failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => brandAssetService.deleteBackgroundImage(),
    onSuccess: () => {
      refreshBranding();
      toast.success(`${title} removed.`);
    },
    onError: (err) => toast.error((err as unknown as AppError).message || "Removal failed."),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null);
  const upload = () => {
    if (!file) { toast.error("Choose a file to upload."); return; }
    uploadMutation.mutate(file);
  };

  const currentUrl = branding?.hasBackgroundImage ? (currentImageBlobUrl ?? null) : null;
  const imageBoxCls = cn("rounded-md border object-cover", aspect === "wide" ? "h-10 w-20" : "h-10 w-10");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>File</label>
            <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40">
              <ImageUp className="h-4 w-4 shrink-0" />
              <span className="truncate">{file ? file.name : "No file chosen"}</span>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />
            </label>
          </div>
          <div>
            <label className={labelCls}>Preview</label>
            <div className={cn("flex h-[38px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30", aspect === "wide" ? "" : "w-[38px]")}>
              {localPreviewUrl ? (
                <img src={localPreviewUrl} alt="Selected file preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">Select a file to preview</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-center">
          <button
            onClick={upload}
            disabled={uploadMutation.isPending || !file}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploadMutation.isPending ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <h3 className="text-base font-semibold text-foreground">{tableTitle}</h3>
        <p className="mb-4 text-xs text-muted-foreground">{tableSubtitle}</p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2.5">Organization</th><th className="px-3 py-2.5">Preview</th><th className="px-3 py-2.5 text-right">Action</th></tr></thead>
            <tbody>
              {isLoading || (branding?.hasBackgroundImage && isImageLoading) ? (
                <tr><td colSpan={3} className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : isError ? (
                <tr><td colSpan={3} className="py-10 text-center text-sm text-destructive">Could not load branding data.</td></tr>
              ) : !currentUrl ? (
                <tr><td colSpan={3} className="py-10 text-center text-sm text-muted-foreground">No background image set yet.</td></tr>
              ) : (
                <tr className="border-b last:border-0 hover:bg-accent/50">
                  <td className="px-3 py-2.5 font-medium text-foreground">{branding?.companyName ?? "Your organization"}</td>
                  <td className="px-3 py-2.5">
                    <img src={currentUrl} alt="" className={imageBoxCls} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Demo mode: unchanged local-only simulation (no backend exists to talk
 * to for a demo session) -- purely illustrative multi-business-unit
 * table, same as before this page was wired to the real API. */
function DemoBrandAssetPage({ title, description, tableTitle, tableSubtitle, aspect }: { title: string; description: string; tableTitle: string; tableSubtitle: string; aspect: "wide" | "square" }) {
  const [businessUnit, setBusinessUnit] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [assets, setAssets] = useState<DemoAsset[]>([]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null);

  const upload = () => {
    if (!businessUnit) { toast.error("Select a business unit."); return; }
    if (!file) { toast.error("Choose a file to upload."); return; }
    const url = URL.createObjectURL(file);
    setAssets((a) => [{ businessUnit, url }, ...a.filter((x) => x.businessUnit !== businessUnit)]);
    setFile(null);
    toast.success(`${title} updated for ${businessUnit}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
            <select value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} className={inputCls}>
              <option value="">Choose business unit</option>{DEMO_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>File</label>
            <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40">
              <ImageUp className="h-4 w-4 shrink-0" />
              <span className="truncate">{file ? file.name : "No file chosen"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-center"><button onClick={upload} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90">Upload</button></div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <h3 className="text-base font-semibold text-foreground">{tableTitle}</h3>
        <p className="mb-4 text-xs text-muted-foreground">{tableSubtitle}</p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2.5">Business Name</th><th className="px-3 py-2.5">Preview</th><th className="px-3 py-2.5 text-right">Action</th></tr></thead>
            <tbody>
              {assets.length === 0 ? (
                <tr><td colSpan={3} className="py-10 text-center text-sm text-muted-foreground">No data available in table</td></tr>
              ) : assets.map((a) => (
                <tr key={a.businessUnit} className="border-b last:border-0 hover:bg-accent/50">
                  <td className="px-3 py-2.5 font-medium text-foreground">{a.businessUnit}</td>
                  <td className="px-3 py-2.5">
                    <img src={a.url} alt="" className={cn("rounded-md border object-cover", aspect === "wide" ? "h-10 w-20" : "h-10 w-10")} />
                  </td>
                  <td className="px-3 py-2.5 text-right"><button onClick={() => setAssets((p) => p.filter((x) => x.businessUnit !== a.businessUnit))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
