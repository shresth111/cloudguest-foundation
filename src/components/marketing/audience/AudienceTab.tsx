import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useMarketingScope, useOrgVenues, useVenueMarketingStatus } from "@/hooks/useMarketing";
import type { AudienceFilter, MarketingStatus } from "@/types/marketing";
import { marketingErrorMessage } from "../marketing-helpers";
import { PortalConsentCard } from "./PortalConsentCard";
import { AudienceFilterForm } from "./AudienceFilterForm";
import { AudiencePreviewCard } from "./AudiencePreviewCard";
import { ContactsTable } from "./ContactsTable";

const ORG_DEFAULT = "__org_default__";

/**
 * The portal opt-in card for an ORG-SCOPED caller. The opt-in is a setting
 * of each venue's WiFi page (§4.8, §5.1), so the card gets a venue selector:
 * the organisation's default portal (read-only -- §5.1's PUT takes one
 * location) or any venue, whose own setting and counts are read with that
 * venue named (the contract's only way to ask for one venue's opt-in).
 */
function OrgPortalConsent() {
  const { venues } = useOrgVenues();
  const [selected, setSelected] = useState<string>(ORG_DEFAULT);
  const venueId = selected === ORG_DEFAULT ? null : selected;
  const st = useVenueMarketingStatus(venueId);

  const select = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">WiFi page of</span>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger className="w-60" aria-label="Venue for the opt-in setting">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ORG_DEFAULT}>Organisation default</SelectItem>
          {venues.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (st.isLoading) return <LoadingSkeleton rows={3} />;
  if (st.isError || !st.data) {
    return (
      <div className="space-y-2">
        {select}
        <ErrorState
          title="Couldn't load this opt-in setting"
          description={marketingErrorMessage(st.error)}
          onRetry={() => void st.refetch()}
        />
      </div>
    );
  }
  return <PortalConsentCard status={st.data} locationId={venueId} venueSelect={select} />;
}

/**
 * Audience tab (spec §8.1/§8.2): leads with the opt-in, because at launch
 * that is the whole story (0 opted in until guests start ticking it); then
 * an audience explorer using the same filter + live count the composer
 * uses; then the contacts list.
 */
export function AudienceTab({ status }: { status: MarketingStatus }) {
  const scope = useMarketingScope();
  const [filter, setFilter] = useState<AudienceFilter>({ channel: "whatsapp" });

  return (
    <div className="space-y-5">
      {scope.kind === "organization" ? (
        <OrgPortalConsent />
      ) : (
        <PortalConsentCard status={status} locationId={scope.locationId} />
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Explore your audience</h3>
          <p className="text-xs text-muted-foreground">
            See how many opted-in guests a set of filters would reach before you build a campaign.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <AudienceFilterForm value={filter} onChange={setFilter} status={status} />
          <AudiencePreviewCard filter={filter} status={status} />
        </div>
      </section>

      <ContactsTable />
    </div>
  );
}
