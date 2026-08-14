import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { brandAssetService } from "@/services/brand-asset.service";
import type { AppError } from "@/services/api";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const DEMO_UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

interface DemoAsset { businessUnit: string; url: string; }

const BRANDING_QUERY_KEY = ["branding", "current-organization"] as const;

function BrandImageIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 80 48" className="hidden h-12 w-auto shrink-0 sm:block" fill="none">
      <rect x="6" y="4" width="46" height="36" rx="5" fill="#2e2a5c" stroke="#a78bfa" strokeWidth="1.5" />
      <circle cx="17" cy="15" r="4" fill="#22d3ee" fillOpacity="0.8" />
      <motion.path
        d="M10 33l11-11 8 8 7-7 9 9"
        stroke="#f0abfc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      <motion.g
        animate={shouldReduceMotion ? { opacity: 0.9 } : { y: [0, -3, 0], opacity: [0.85, 1, 0.85] }}
        transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "64px 24px" }}
      >
        <circle cx="64" cy="24" r="11" fill="#1e1b4b" stroke="#4f46e5" strokeWidth="2" />
        <path d="M64 30v-12M59 23l5-5 5 5" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </motion.g>
    </svg>
  );
}

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

  const [dragActive, setDragActive] = useState(false);

  const pickFile = (f: File | null) => {
    if (f && !ACCEPTED_TYPES.includes(f.type)) {
      toast.error("Use a PNG, JPEG, WEBP, or GIF file.");
      return;
    }
    if (f && f.size > MAX_UPLOAD_BYTES) {
      toast.error(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`);
      return;
    }
    setFile(f);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => pickFile(e.target.files?.[0] ?? null);
  const upload = () => {
    if (!file) { toast.error("Choose a file to upload."); return; }
    uploadMutation.mutate(file);
  };

  const currentUrl = branding?.hasBackgroundImage ? (currentImageBlobUrl ?? null) : null;
  // Whatever the guest would actually see right now: the just-picked file
  // takes priority (so a customer previews their new choice immediately,
  // before committing to Upload), falling back to the persisted image.
  const previewUrl = localPreviewUrl ?? currentUrl;
  const hasAnyImage = !!(branding?.hasBackgroundImage || file);
  const loadingCurrent = isLoading || (branding?.hasBackgroundImage && isImageLoading);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <ImageUp className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <BrandImageIllustration />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          <label className={labelCls}>
            {branding?.hasBackgroundImage ? "Replace image" : "Upload image"}
          </label>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-input hover:border-primary/50 hover:bg-accent/40",
            )}
          >
            <ImageUp className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-medium text-foreground">
                {file ? file.name : "Drop an image, or click to browse"}
              </span>
            </div>
            {!file && (
              <p className="text-xs text-muted-foreground">PNG, JPEG, WEBP, or GIF · up to 5 MB</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={handleFile}
            />
          </label>
          <p className="mt-3 text-xs text-muted-foreground">
            {aspect === "wide"
              ? "This fills the whole screen behind the guest sign-in card, dimmed for legibility — a wide, landscape image (1920×1080 or similar) works best. See the live preview alongside."
              : "Displayed at a small, fixed size — a square image gives the sharpest result."}
          </p>

          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={upload}
              disabled={uploadMutation.isPending || !file}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </button>
            {branding?.hasBackgroundImage && (
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                title="Remove current image"
                className="inline-flex items-center justify-center rounded-lg border p-2.5 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
          {isError && (
            <p className="mt-3 text-xs text-destructive">Could not load your current branding.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          <label className={labelCls}>Live preview — what guests will see</label>
          <div className="relative aspect-[9/16] max-h-[380px] w-full overflow-hidden rounded-2xl border shadow-inner">
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, #0F172A, #1E293B)" }}
            />
            {loadingCurrent ? (
              <div className="absolute inset-0 grid place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-white/70" />
              </div>
            ) : (
              previewUrl && (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-cover bg-center opacity-30"
                  style={{ backgroundImage: `url(${previewUrl})` }}
                />
              )
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white shadow-lg backdrop-blur">
                <Wifi className="h-5 w-5" />
              </div>
              <div className="w-full max-w-[220px] rounded-xl border border-white/15 bg-white/10 p-4 text-center backdrop-blur-md">
                <p className="text-xs font-semibold text-white">Guest Sign In</p>
                <div className="mt-3 h-8 rounded-lg border border-white/20 bg-white/10" />
                <div className="mt-2 h-8 rounded-lg bg-white/90" />
              </div>
            </div>
          </div>
          {!hasAnyImage && !loadingCurrent && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              No background image set — guests currently see a plain gradient.
            </p>
          )}
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <ImageUp className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <BrandImageIllustration />
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
        {assets.length === 0 ? (
          <EmptyState icon={ImageUp} title="No images uploaded" description="Upload an image above to see it listed here." />
        ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader><TableRow><TableHead className="text-xs font-medium">Business Name</TableHead><TableHead className="text-xs font-medium">Preview</TableHead><TableHead className="text-right text-xs font-medium">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.businessUnit} className="border-b">
                  <TableCell className="font-medium text-foreground">{a.businessUnit}</TableCell>
                  <TableCell>
                    <img src={a.url} alt="" className={cn("rounded-md border object-cover", aspect === "wide" ? "h-10 w-20" : "h-10 w-10")} />
                  </TableCell>
                  <TableCell className="text-right"><button onClick={() => setAssets((p) => p.filter((x) => x.businessUnit !== a.businessUnit))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </div>
    </div>
  );
}
