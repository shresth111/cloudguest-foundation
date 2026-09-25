import { useState } from "react";
import { useCustomerStore } from "@/stores/customerStore";
import type { AudienceFilter, MarketingStatus } from "@/types/marketing";
import { PortalConsentCard } from "./PortalConsentCard";
import { AudienceFilterForm } from "./AudienceFilterForm";
import { AudiencePreviewCard } from "./AudiencePreviewCard";
import { ContactsTable } from "./ContactsTable";

/**
 * Audience tab (spec §8.1/§8.2): leads with the opt-in, because at launch
 * that is the whole story (0 opted in until guests start ticking it); then
 * an audience explorer using the same filter + live count the composer
 * uses; then the contacts list.
 */
export function AudienceTab({
  status,
  locationId,
}: {
  status: MarketingStatus;
  locationId: string | null;
}) {
  const venueName = useCustomerStore((s) => s.activeLocation?.name ?? null);
  const [filter, setFilter] = useState<AudienceFilter>({ channel: "whatsapp" });

  return (
    <div className="space-y-5">
      <PortalConsentCard status={status} locationId={locationId} />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Explore your audience</h3>
          <p className="text-xs text-muted-foreground">
            See how many opted-in guests a set of filters would reach before you build a campaign.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <AudienceFilterForm
            value={filter}
            onChange={setFilter}
            status={status}
            venueName={venueName}
          />
          <AudiencePreviewCard filter={filter} status={status} />
        </div>
      </section>

      <ContactsTable />
    </div>
  );
}
