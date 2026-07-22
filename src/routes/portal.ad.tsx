import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/ad")({
  component: AdPage,
});

/**
 * The real backend only models a single static banner image + link
 * (`advertisement_banner_url`/`advertisement_banner_link`) -- no multi-slot
 * rotation, no skip timer. This page only renders at all when a banner is
 * configured (see portal.verify.tsx's navigate target).
 */
function AdPage() {
  const { config } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/ad" });

  const banner = config?.advertisementBannerUrl;

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <h1 className="text-xl font-semibold">While you wait…</h1>
        <PortalCard className="overflow-hidden p-0">
          {banner ? (
            config?.advertisementBannerLink ? (
              <a href={config.advertisementBannerLink} target="_blank" rel="noreferrer">
                <img src={banner} alt="" className="w-full object-cover" />
              </a>
            ) : (
              <img src={banner} alt="" className="w-full object-cover" />
            )
          ) : null}
        </PortalCard>
        <Button
          className="h-11 w-full font-semibold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
          onClick={() => navigate({ to: "/portal/success", search: (prev) => prev })}
        >
          Continue
        </Button>
      </div>
    </PortalShell>
  );
}
