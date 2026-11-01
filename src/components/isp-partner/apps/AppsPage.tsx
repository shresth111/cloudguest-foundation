/** `/partner/apps` (APPS-FE over JAZE-5): Helpdesk, Tasks, Announcements,
 * Discounts, Inventory, Leads. Hidden while `ISP_APPS_ENABLED` is off (the
 * probe 404s) or the role lacks `isp_apps.read`. Every list call is
 * zone-narrowed by the ZONE-1 interceptor. */
import { LayoutGrid } from "lucide-react";
import { MEmptyState, MSectionHeader, MSeg } from "@/components/master/MasterKit";
import { ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { AnnouncementsTab } from "@/components/isp-partner/apps/AnnouncementsTab";
import { DiscountsTab } from "@/components/isp-partner/apps/DiscountsTab";
import { HelpdeskTab } from "@/components/isp-partner/apps/HelpdeskTab";
import { InventoryTab } from "@/components/isp-partner/apps/InventoryTab";
import { LeadsTab } from "@/components/isp-partner/apps/LeadsTab";
import { TasksTab } from "@/components/isp-partner/apps/TasksTab";
import { useAppsEnabled } from "@/hooks/isp-partner/useApps";
import { isNotFound } from "@/lib/isp-partner/errors";

export const APPS_TABS = [
  "helpdesk",
  "tasks",
  "announcements",
  "discounts",
  "inventory",
  "leads",
] as const;
export type AppsTab = (typeof APPS_TABS)[number];

const LABEL: Record<AppsTab, string> = {
  helpdesk: "Helpdesk",
  tasks: "Tasks",
  announcements: "Announcements",
  discounts: "Discounts",
  inventory: "Inventory",
  leads: "Leads",
};

export function AppsPage({ tab, onTab }: { tab: AppsTab; onTab: (t: AppsTab) => void }) {
  const on = useAppsEnabled();
  if (on.loading) return <LoadingBlock />;
  if (!on.enabled)
    return on.error && !isNotFound(on.error) ? (
      <ErrorBlock error={on.error} what="Apps" />
    ) : (
      <MEmptyState
        icon={LayoutGrid}
        title="Apps are not switched on"
        description="Helpdesk, field tasks, announcements, discounts, inventory and leads are not switched on for your network."
      />
    );
  return (
    <div className="space-y-4">
      <MSectionHeader
        eyebrow="Apps"
        title={LABEL[tab]}
        description="Support tickets, field work and sales, for the zone you are viewing."
      />
      <MSeg<AppsTab>
        value={tab}
        onChange={onTab}
        options={APPS_TABS.map((t) => ({ value: t, label: LABEL[t] }))}
      />
      {tab === "helpdesk" && <HelpdeskTab />}
      {tab === "tasks" && <TasksTab />}
      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "discounts" && <DiscountsTab />}
      {tab === "inventory" && <InventoryTab />}
      {tab === "leads" && <LeadsTab />}
    </div>
  );
}
