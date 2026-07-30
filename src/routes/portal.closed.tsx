import { createFileRoute } from "@tanstack/react-router";
import { Moon } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/closed")({
  component: ClosedPage,
});

/**
 * Real business-hours enforcement (backend/app/domains/captive_portal --
 * business_hours_enabled/timezone/schedule, computed live into
 * `config.isOpenNow` on every GET /captive-portal/resolve): a guest
 * reaching the portal outside the configured schedule sees this instead
 * of the sign-in card. Previously the "Business Hours" admin toggle had
 * no guest-facing effect at all -- see that page's own comment.
 */
function ClosedPage() {
  const { config } = usePortalRuntime();

  return (
    <PortalShell variant="light" showHeader={false}>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-100 text-slate-500">
            <Moon className="h-10 w-10" />
          </div>
          <h1
            className="mt-5 text-2xl font-bold text-slate-900"
            style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
          >
            {config?.name ? `${config.name} is currently closed` : "Currently closed"}
          </h1>
        </div>
        <PortalCard variant="light" className="text-center text-sm text-slate-500">
          {config?.businessHoursClosedMessage?.trim() ||
            "We're currently closed. Please check back during business hours to connect."}
        </PortalCard>
      </div>
    </PortalShell>
  );
}
