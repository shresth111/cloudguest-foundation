/**
 * The Location page's Network tab: one router, several network views.
 *
 * The picker lives here, not in each view, for two reasons:
 *
 *  1. VLANs, IP addresses and the rest are all facts about the SAME router. A
 *     picker per view would let an ISP switch views and silently start
 *     configuring a different MikroTik than the one they were on.
 *  2. An ISP manages each location's MikroTiks separately and a location can
 *     hold more than one, so "which router?" is a real question that has to be
 *     asked once and answered once. `RouterSelect` lists only this location's
 *     routers, so it can never offer one the twin would refuse with a 404.
 */
import { useState } from "react";

import { MSeg } from "@/components/master/MasterKit";
import { Card } from "@/components/isp-partner/kit";
import { DhcpPoolsPanel } from "@/components/isp-partner/workspace/DhcpPoolsPanel";
import { NetworkZonesPanel } from "@/components/isp-partner/workspace/NetworkZonesPanel";
import { PortForwardingPanel } from "@/components/isp-partner/workspace/PortForwardingPanel";
import { QosPanel } from "@/components/isp-partner/workspace/QosPanel";
import { RouterSelect } from "@/components/isp-partner/workspace/RouterSelect";

type View = "zones" | "addresses" | "forwarding" | "qos";

const VIEWS: { value: View; label: string }[] = [
  { value: "zones", label: "Network Zones" },
  { value: "addresses", label: "IP Addresses" },
  { value: "forwarding", label: "Port Forwarding" },
  { value: "qos", label: "Call Priority" },
];

export function NetworkPanel({ locationId }: { locationId: string }) {
  const [routerId, setRouterId] = useState<string | null>(null);
  const [view, setView] = useState<View>("zones");

  if (!routerId) {
    return (
      <Card
        title="Network"
        actions={<RouterSelect locationId={locationId} value={null} onChange={setRouterId} />}
      >
        <p className="text-sm text-muted-foreground">
          Pick this venue's router. VLANs and IP addresses live on a router, so each MikroTik at
          this location has its own set.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RouterSelect locationId={locationId} value={routerId} onChange={setRouterId} />
        <MSeg<View> value={view} onChange={setView} options={VIEWS} />
      </div>
      {view === "zones" && <NetworkZonesPanel routerId={routerId} />}
      {view === "addresses" && <DhcpPoolsPanel routerId={routerId} />}
      {view === "forwarding" && <PortForwardingPanel routerId={routerId} />}
      {view === "qos" && <QosPanel routerId={routerId} />}
    </div>
  );
}
