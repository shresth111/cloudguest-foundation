/**
 * QA-021: the guest portal footer's support line on an ISP portal host.
 * Mounted only by the build-time swap in `vite-plugins/isp-portal-support.ts`
 * (flag on). On any other host it renders exactly `fallback` and never calls
 * the backend.
 */
import { useEffect, useState } from "react";
import {
  fetchPortalSupport,
  isIspPortalHost,
  portalLocationId,
  supportLine,
} from "@/lib/isp-partner/portal-support";

export function IspPortalSupport({ fallback }: { fallback: string }) {
  const [line, setLine] = useState(fallback);

  useEffect(() => {
    setLine(fallback);
    if (typeof window === "undefined" || !isIspPortalHost(window.location.hostname)) return;
    const locationId = portalLocationId(window.location.search);
    if (!locationId) return;
    let live = true;
    void fetchPortalSupport(locationId).then((contact) => {
      if (live) setLine(supportLine(fallback, contact));
    });
    return () => {
      live = false;
    };
  }, [fallback]);

  return <>{line}</>;
}
