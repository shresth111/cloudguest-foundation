/**
 * Small building blocks the workspace and its slot pages share.
 *
 *  - `ComingSoon`: the honest screen for a nav row whose page has not been
 *    built in this console yet. No sample data, no buttons that pretend.
 *  - `AddonLocked`: a paid add-on this ISP has not been allowed (ADDENDUM_04
 *    §2: Master's allowance defaults to none).
 *  - `WithRouter`: the one-router picker for screens whose data lives ON a
 *    router (VLANs, DHCP, QoS, firewall, ...). It lists only the picked
 *    location's routers, so it can never offer one the twin would 404.
 */
import { useState, type ReactNode } from "react";
import { Lock, Router as RouterIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MButton, MEmptyState } from "@/components/master/MasterKit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  useCustomerAddons,
  useSetCustomerAddon,
} from "@/components/isp-partner/customer-shell/addons";
import type { PartnerAddonKey } from "@/components/isp-partner/customer-shell/nav";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { Card } from "@/components/isp-partner/kit";
import { RouterSelect } from "@/components/isp-partner/workspace/RouterSelect";

export function ComingSoon({ label }: { label: string }) {
  return (
    <Card title={label}>
      <MEmptyState
        icon={Sparkles}
        title="Coming in this console soon"
        description={`${label} is not available in the partner console yet. Nothing here is saved or sent.`}
      />
    </Card>
  );
}

export function AddonLocked({
  label,
  customerId,
  addon,
}: {
  label: string;
  customerId: string;
  addon: PartnerAddonKey;
}) {
  const { can } = usePartner();
  const q = useCustomerAddons(customerId);
  const set = useSetCustomerAddon(customerId);
  const row = q.data?.find((a) => a.key === addon);
  const allowed = !!row?.allowed;
  return (
    <Card title={label}>
      <MEmptyState
        icon={Lock}
        title={allowed ? "Add-on is off for this customer" : "Add-on not enabled for your account"}
        description={
          allowed
            ? `${label} is a paid add-on that Wyfy allows on your account. Switch it on for this customer to open it here.`
            : `${label} is a paid add-on. Wyfy enables add-ons per ISP partner; ask your Wyfy account manager to allow it for your customers.`
        }
        action={
          allowed && can("isp_partner.manage") ? (
            <MButton
              disabled={set.isPending}
              onClick={() =>
                set.mutate(
                  { key: addon, enabled: true },
                  {
                    onSuccess: () => toast.success(`${label} switched on for this customer.`),
                    onError: (e) => toast.error(ispErrorMessage(e)),
                  },
                )
              }
            >
              Switch on for this customer
            </MButton>
          ) : undefined
        }
      />
    </Card>
  );
}

export function WithRouter({
  locationId,
  title,
  children,
}: {
  locationId: string;
  title: string;
  children: (routerId: string) => ReactNode;
}) {
  const [routerId, setRouterId] = useState<string | null>(null);
  if (!routerId) {
    return (
      <Card
        title={title}
        actions={<RouterSelect locationId={locationId} value={null} onChange={setRouterId} />}
      >
        <MEmptyState
          icon={RouterIcon}
          title="Pick this venue's router"
          description="This setting lives on a router, so each MikroTik at this location has its own."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <RouterSelect locationId={locationId} value={routerId} onChange={setRouterId} />
      </div>
      {children(routerId)}
    </div>
  );
}
