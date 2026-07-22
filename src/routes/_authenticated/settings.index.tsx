import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ChevronRight, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import {
  SETTINGS_NAV,
  SettingsSidebar,
  type SettingsNavItem,
} from "@/components/settings/SettingsSidebar";
import { SettingsSearch } from "@/components/settings/SettingsSearch";
import { SettingsQuickActions } from "@/components/settings/SettingsQuickActions";
import { GeneralPanel } from "@/components/settings/panels/GeneralPanel";
import { BrandingPanel } from "@/components/settings/panels/BrandingPanel";
import { AuthenticationPanel } from "@/components/settings/panels/AuthenticationPanel";
import { SecurityPanel } from "@/components/settings/panels/SecurityPanel";
import { NotificationsPanel } from "@/components/settings/panels/NotificationsPanel";
import { EmailPanel } from "@/components/settings/panels/EmailPanel";
import { SmsPanel } from "@/components/settings/panels/SmsPanel";
import { StoragePanel } from "@/components/settings/panels/StoragePanel";
import { IntegrationsPanel } from "@/components/settings/panels/IntegrationsPanel";
import { PaymentPanel } from "@/components/settings/panels/PaymentPanel";
import { ApiPanel } from "@/components/settings/panels/ApiPanel";
import { SystemPanel } from "@/components/settings/panels/SystemPanel";
import { BackupPanel } from "@/components/settings/panels/BackupPanel";
import { FeatureFlagsPanel } from "@/components/settings/panels/FeatureFlagsPanel";
import { LicensePanel } from "@/components/settings/panels/LicensePanel";
import { AboutPanel } from "@/components/settings/panels/AboutPanel";
import { useSettings } from "@/hooks/useSettings";
import type { SettingsSectionId } from "@/types/settings";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const q = useSettings();
  const [active, setActive] = useState<SettingsSectionId>("general");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!search) return;
    const first = SETTINGS_NAV.find(matcher(search));
    if (first) setActive(first.id);
  }, [search]);

  const filteredNav = useMemo<SettingsNavItem[]>(() => {
    if (!search.trim()) return SETTINGS_NAV;
    return SETTINGS_NAV.filter(matcher(search));
  }, [search]);

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError || !q.data)
    return <ErrorState title="Unable to load settings" description="Retry to refresh the platform configuration." onRetry={() => q.refetch()} />;

  const data = q.data;
  const activeItem = SETTINGS_NAV.find((i) => i.id === active) ?? SETTINGS_NAV[0];

  const renderPanel = () => {
    switch (active) {
      case "general":       return <GeneralPanel data={data.general} />;
      case "branding":      return <BrandingPanel />;
      case "authentication":return <AuthenticationPanel data={data.auth} />;
      case "security":      return <SecurityPanel data={data.security} />;
      case "notifications": return <NotificationsPanel data={data.notifications} />;
      case "email":         return <EmailPanel data={data.email} />;
      case "sms":           return <SmsPanel data={data.sms} />;
      case "storage":       return <StoragePanel data={data.storage} />;
      case "integrations":  return <IntegrationsPanel data={data.integrations} />;
      case "payment":       return <PaymentPanel data={data.payment} />;
      case "api":           return <ApiPanel data={data.api} />;
      case "system":        return <SystemPanel data={data.system} />;
      case "backup":        return <BackupPanel data={data.backup} />;
      case "feature_flags": return <FeatureFlagsPanel data={data.featureFlags} />;
      case "license":       return <LicensePanel data={data.license} />;
      case "about":         return <AboutPanel data={data.about} />;
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure identity, security, integrations and runtime behaviour.
            <span className="ml-2 text-xs text-muted-foreground/80">Last updated {new Date(data.updatedAt).toLocaleString()}</span>
          </p>
        </div>
        <SettingsQuickActions />
      </header>

      {data.system.maintenanceMode && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-medium">Maintenance mode is enabled</div>
            <div className="text-xs opacity-80">Tenants are seeing the maintenance page. Disable it from System when ready.</div>
          </div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setActive("system"); toast.info("Jumped to System settings"); }}>
            Go to System
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="border-border/60">
            <CardContent className="space-y-4 p-4">
              <SettingsSearch value={search} onChange={setSearch} />
              {filteredNav.length ? (
                <SettingsSidebar active={active} onSelect={setActive} items={filteredNav} />
              ) : (
                <EmptyState icon={Settings} title="No matches" description="Try a different search term." />
              )}
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 space-y-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Settings</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{activeItem.label}</span>
          </nav>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="min-w-0"
            >
              {renderPanel()}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function matcher(term: string) {
  const t = term.trim().toLowerCase();
  return (i: SettingsNavItem) =>
    i.label.toLowerCase().includes(t) ||
    i.description.toLowerCase().includes(t) ||
    i.group.toLowerCase().includes(t) ||
    i.id.replace("_", " ").includes(t);
}
