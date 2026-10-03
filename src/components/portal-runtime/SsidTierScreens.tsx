/**
 * Guest portal screens for speed tiers by WiFi network (Aruba Instant On).
 *
 *  - `SsidNeedsPassScreen`: the guest is on the venue's paid network
 *    (e.g. WYFY_PREMIUM) without a voucher pass. Instead of POSTing a login
 *    the RADIUS hub will refuse (the AP would then show its own generic
 *    "Login error. Please retry."), say why and offer the voucher path.
 *  - `SsidUpgradeHintScreen`: the guest holds a pass that opens a faster
 *    network than the one they are on -- tell them to join it, then let them
 *    continue here.
 *
 * Copy comes from `@/lib/ssid-tiers` (pure, tested). English only, like the
 * other vendor-specific portal notices.
 */
import { Link } from "@tanstack/react-router";
import { PortalShell, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import type { usePortalLinkSearch } from "@/components/portal-runtime/usePortalLinkSearch";
import { needsPassBody, needsPassTitle, upgradeHint, type PortalNetwork } from "@/lib/ssid-tiers";

export function SsidNeedsPassScreen({
  network,
  portalSearch,
}: {
  network: PortalNetwork;
  portalSearch: ReturnType<typeof usePortalLinkSearch>;
}) {
  return (
    <PortalShell showBrandPanel={false}>
      <div className="flex flex-1 flex-col justify-center gap-5" data-testid="ssid-needs-pass">
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            <h1 className="pg-subtitle text-[var(--pg-ink)]">{needsPassTitle(network)}</h1>
            <p className="mt-1 pg-meta text-[var(--pg-ink-muted)]">{needsPassBody(network)}</p>
          </PortalTextPlate>
        </div>
        <Link
          to="/portal/auth/$method"
          params={{ method: "voucher" }}
          search={portalSearch}
          className={`${PG_PRIMARY_BTN} flex items-center justify-center`}
        >
          Enter a voucher code
        </Link>
        <Link
          to="/portal/welcome"
          search={portalSearch}
          className="mx-auto pg-meta font-medium text-[var(--pg-ink-muted)] underline-offset-2 hover:underline"
        >
          Use a different sign-in
        </Link>
      </div>
    </PortalShell>
  );
}

export function SsidUpgradeHintScreen({
  networks,
  onContinue,
}: {
  networks: PortalNetwork[];
  onContinue: () => void;
}) {
  const hint = upgradeHint(networks);
  return (
    <PortalShell showBrandPanel={false}>
      <div className="flex flex-1 flex-col justify-center gap-5" data-testid="ssid-upgrade-hint">
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            <h1 className="pg-subtitle text-[var(--pg-ink)]">Faster WiFi is included</h1>
            <p className="mt-1 pg-meta text-[var(--pg-ink-muted)]">{hint}</p>
          </PortalTextPlate>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className={`${PG_PRIMARY_BTN} flex items-center justify-center`}
        >
          Continue on this network
        </button>
      </div>
    </PortalShell>
  );
}
