import { createFileRoute, notFound } from "@tanstack/react-router";
import { IspPartnersPage } from "@/components/master/isp-partners/IspPartnersPage";
import { isIspPartnerFeEnabled } from "@/lib/isp-partner/network-host";

/**
 * Master: ISP partners (TASKS FS-2). A child of the existing `master.tsx`
 * layout by file name only (that file is not edited), so it inherits the
 * operator guard and the customer-host bounce. With the build flag
 * `VITE_ISP_PARTNER_ENABLED` unset it is the existing not-found page, the
 * same as every other ISP partner surface.
 */
export const Route = createFileRoute("/master/isp-partners")({
  beforeLoad: () => {
    if (!isIspPartnerFeEnabled()) throw notFound();
  },
  component: IspPartnersPage,
});
