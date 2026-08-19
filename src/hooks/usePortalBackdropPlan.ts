import { useMemo } from "react";
import { usePortalRuntimeOptional } from "@/context/PortalRuntimeContext";
import { resolveBackdropPlan, type BackdropPlan } from "@/lib/portal-backdrop";

/**
 * Resolves the venue photo's treatment once per render, from config alone.
 *
 * Lives in its own file rather than beside `PortalCard` in `PortalShell.tsx`
 * because a module that exports React components may only additionally export
 * constants (`react-refresh/only-export-components`); a hook alongside them
 * breaks Fast Refresh for the whole file.
 *
 * `PortalCard` needs this answer for its adaptive edge and has no props to
 * receive it through -- it is called from eleven `portal.*.tsx` routes with
 * nothing but children. Returns `null` when there is no photo at all, which
 * is the "there is nothing to decide" case: no scrim, no polarity flip, no
 * ring, today's flat-canvas render.
 *
 * All of the actual reasoning lives in `src/lib/portal-backdrop.ts`; this is
 * only the memoized bridge from `PortalRuntimeContext` to it.
 */
export function usePortalBackdropPlan(): BackdropPlan | null {
  // Optional on purpose -- `PortalCard` calls this and is rendered outside
  // `PortalRuntimeProvider` by `portal.tsx`'s `IncompletePortalLinkError`.
  // See `usePortalRuntimeOptional`.
  const config = usePortalRuntimeOptional()?.config;
  const hasPhoto = !!config?.backgroundImageUrl;
  const overlayStrength = config?.backgroundOverlayStrength ?? 55;
  const focalX = config?.backgroundFocalX;
  const focalY = config?.backgroundFocalY;
  const luminance = config?.backgroundLuminance ?? null;
  const topLuminance = config?.backgroundTopLuminance ?? null;
  const entropy = config?.backgroundEntropy ?? null;
  return useMemo(
    () =>
      hasPhoto
        ? resolveBackdropPlan({
            overlayStrength,
            focalX,
            focalY,
            measurements: { luminance, topLuminance, entropy },
          })
        : null,
    [hasPhoto, overlayStrength, focalX, focalY, luminance, topLuminance, entropy],
  );
}
