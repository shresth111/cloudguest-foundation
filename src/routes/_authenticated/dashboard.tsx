import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { LockedBadge } from "@/components/permissions/Can";
import {
  EmptyDashboard,
  dashboardWidgetRegistry,
  widgetSizeClass,
} from "@/components/dashboard/widgetRegistry";
import { useAuth } from "@/context/AuthContext";
import { useDashboardLayout, usePermissions } from "@/hooks/usePermissions";
import { legacyRoleBucket } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, roles } = useAuth();
  const { data: layout, isLoading } = useDashboardLayout();
  const { can, hasFeature, isLocked } = usePermissions();

  if (!user) return null;
  if (legacyRoleBucket(roles) === "super_admin") return <SuperAdminDashboard />;

  if (isLoading || !layout) {
    return (
      <div className="grid grid-cols-12 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="col-span-12 h-40 rounded-2xl md:col-span-6 xl:col-span-4" />
        ))}
      </div>
    );
  }

  const widgets = [...layout.widgets].sort((a, b) => a.order - b.order);

  if (widgets.length === 0) return <EmptyDashboard />;

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={layout.variant}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="grid grid-cols-12 gap-4"
      >
        {widgets.map((w) => {
          const render = dashboardWidgetRegistry[w.kind];
          if (!render) return null;

          if (w.featureFlag && !hasFeature(w.featureFlag)) return null;

          if (w.requires) {
            const { module, action = "view" } = w.requires;
            const allowed = can(module, action);
            if (!allowed && isLocked(module)) {
              return (
                <div key={w.id} className={widgetSizeClass(w.size)}>
                  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card/60 p-6 text-center">
                    <div className="text-sm font-medium">{w.title ?? module}</div>
                    <LockedBadge />
                  </div>
                </div>
              );
            }
            if (!allowed) return null;
          }

          return (
            <motion.div
              key={w.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: (w.order % 6) * 0.02 }}
              className={widgetSizeClass(w.size)}
            >
              {render(w)}
            </motion.div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
