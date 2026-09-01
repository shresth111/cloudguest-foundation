import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { brandAssetService } from "@/services/brand-asset.service";
import type { AppError } from "@/services/api";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const BRANDING_QUERY_KEY = ["branding", "current-organization"] as const;

/**
 * The organization's login-screen background image, as a section of the
 * Portal configuration card (see PortalPage.tsx).
 *
 * This used to be its own top-level "Background Image" page under the
 * Access & Policy nav group (the former BrandAssetPage.tsx) -- the wrong
 * home for it: it is a portal *appearance* setting, not an access-policy
 * one, it writes the same org-level branding record the Portal Logo right
 * above it does, and it only ever changes what a guest sees on the
 * sign-in screen. Living here also means the page's real Live Preview --
 * the actual guest component tree, not a mockup -- is what renders the
 * result, so the standalone page's own hand-drawn preview panel is gone
 * rather than duplicated. The old `/background-image` route redirects
 * here (see src/routes/background-image.tsx).
 *
 * Wired to the backend's org-scoped branding endpoints (see
 * src/services/brand-asset.service.ts). There is no per-location concept
 * on the backend -- the `brandings` table is one row per organization
 * (the login screen doesn't know which location a guest belongs to until
 * after they've connected), same as the Portal Logo.
 *
 * "Preview" has two distinct meanings, both handled here:
 *  - Before upload: `URL.createObjectURL(file)` on the just-picked local
 *    file -- a real, standard use of that API for a not-yet-uploaded
 *    preview. Revoked on cleanup so it never leaks.
 *  - After upload: the actual persisted image, re-fetched from
 *    `GET /branding/background-image/raw` (via a local blob URL, since an
 *    `<img>` tag can't send the auth headers that endpoint needs -- see
 *    brand-asset.service.ts's own note on this) -- not the local
 *    pre-upload blob URL. A full page reload re-fetches this from the
 *    server, not from stale local state.
 */
export function PortalBackgroundImage({ onChange }: { onChange?: () => void }) {
  const demo = useIsDemo();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: branding,
    isLoading,
    isError,
  } = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: () => brandAssetService.getBranding(),
    // No real backend exists to talk to for a demo session (same fallback
    // pattern as PortalPage.tsx's own logo upload) -- demo mode keeps a
    // local-only, un-persisted image in `demoImageUrl` below instead.
    enabled: !demo,
  });

  // Demo mode's stand-in for the persisted image: a local blob URL that
  // lives only as long as this component does.
  const [demoImageUrl, setDemoImageUrl] = useState<string | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, [branding?.hasBackgroundImage, branding?.updatedAt]);

  // Blob URLs are never revoked by the browser on their own -- revoke the
  // previous one whenever a new one replaces it (including on unmount).
  useEffect(() => {
    return () => {
      if (currentImageBlobUrl) URL.revokeObjectURL(currentImageBlobUrl);
    };
  }, [currentImageBlobUrl]);

  // Same cleanup for demo mode's local-only stand-in.
  useEffect(() => {
    return () => {
      if (demoImageUrl) URL.revokeObjectURL(demoImageUrl);
    };
  }, [demoImageUrl]);

  // Local, pre-upload preview only -- revoked whenever the selected file
  // changes or the component unmounts, so it never outlives its use.
  useEffect(() => {
    if (!file) {
      setLocalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const refreshBranding = () => qc.invalidateQueries({ queryKey: BRANDING_QUERY_KEY });

  const clearPickedFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadMutation = useMutation({
    mutationFn: (f: File) => brandAssetService.uploadBackgroundImage(f),
    onSuccess: () => {
      refreshBranding();
      clearPickedFile();
      toast.success("Background image updated.");
      onChange?.();
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
      toast.success("Background image removed.");
      onChange?.();
    },
    onError: (err) => toast.error((err as unknown as AppError).message || "Removal failed."),
  });

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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) =>
    pickFile(e.target.files?.[0] ?? null);

  const upload = () => {
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    if (demo) {
      if (demoImageUrl) URL.revokeObjectURL(demoImageUrl);
      // A separate object URL from `localPreviewUrl`'s, so clearing the
      // picked file below can't revoke the one still being rendered.
      setDemoImageUrl(URL.createObjectURL(file));
      clearPickedFile();
      toast.success("Background image updated.");
      onChange?.();
      return;
    }
    uploadMutation.mutate(file);
  };

  const remove = () => {
    if (demo) {
      if (demoImageUrl) URL.revokeObjectURL(demoImageUrl);
      setDemoImageUrl(null);
      toast.success("Background image removed.");
      onChange?.();
      return;
    }
    deleteMutation.mutate();
  };

  const hasSavedImage = demo ? !!demoImageUrl : !!branding?.hasBackgroundImage;
  const savedUrl = demo ? demoImageUrl : (currentImageBlobUrl ?? null);
  // Whatever the guest would actually see right now: the just-picked file
  // takes priority (so a customer previews their new choice immediately,
  // before committing to Upload), falling back to the persisted image.
  const previewUrl = localPreviewUrl ?? savedUrl;
  const loadingSaved = !demo && (isLoading || (branding?.hasBackgroundImage && isImageLoading));
  const busy = uploadMutation.isPending || deleteMutation.isPending;

  return (
    <div>
      <Label className="mb-2 block">Background Image</Label>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-3 transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-input hover:border-primary/50 hover:bg-accent/40",
        )}
      >
        <div className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
          {loadingSaved ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Portal background"
              className="h-full w-full object-cover"
              // Only the persisted blob can go stale here (a revoked or
              // expired URL) -- a just-picked local file always renders.
              onError={() => {
                if (!localPreviewUrl) setCurrentImageBlobUrl(null);
              }}
            />
          ) : (
            <ImageUp className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {file ? file.name : "Drop an image, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">PNG, JPEG, WEBP, or GIF · up to 5 MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={handleFile}
        />
      </label>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={upload} disabled={busy || !file}>
          {uploadMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {uploadMutation.isPending ? "Uploading…" : "Upload"}
        </Button>
        {hasSavedImage && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            title="Remove current image"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Fills the whole screen behind the guest sign-in card, dimmed for legibility -- a wide,
        landscape image (1920×1080 or similar) works best. Shared across every location in this
        organization, same as the Portal Logo. The Live Preview alongside updates once it's
        uploaded.
      </p>
      {isError && (
        <p className="mt-1.5 text-xs text-destructive">Could not load your current branding.</p>
      )}
      {!hasSavedImage && !file && !loadingSaved && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          No background image set — guests currently see a plain gradient.
        </p>
      )}
    </div>
  );
}
