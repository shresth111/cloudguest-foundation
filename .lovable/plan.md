
# CloudGuest V2.0 — Enterprise UX & Design Refactor

This is a **surgical refactor** of the existing frontend. No rebuild, no route churn, no API changes. Everything already in place (permission engine, routes, services, mock data) stays. We upgrade the visual language, add missing shell primitives, and layer new executive/NOC/security/guest dashboards on top of the existing widget registry.

---

## 1. Design System Upgrade (`src/styles.css` + tokens)

Refresh the token layer so every existing component inherits the new look:

- Tighten the neutral scale (cooler grays, deeper contrast in dark mode).
- Introduce accent tokens: `--success`, `--warning`, `--info`, `--danger` + `-soft` variants for KPI states.
- New elevation ramp: `--shadow-xs / sm / md / lg / xl` (soft, layered, low-blur enterprise shadows).
- Radius tokens standardized to `12–16px` (`--radius: 0.875rem`).
- Motion tokens (`--ease-out-enterprise`, durations 120/180/240ms).
- New utilities: `.surface`, `.surface-elevated`, `.surface-muted`, `.hairline`, `.kpi-card`, `.data-grid`, `.shimmer`, `.count-up` (framer-motion-driven).
- Refined `glass-panel` (only used in Portal + top overlays).

New shared primitives under `src/components/ui-ext/`:
- `StatCard` (icon slot, animated counter, delta, sparkline).
- `SectionHeader` (eyebrow, title, description, actions).
- `PageShell` (consistent max-width, spacing, sticky title bar).
- `RightDrawer` (built on shadcn Sheet, standardized widths + header/footer slots).
- `EmptyState` (upgrade existing with illustration slot + primary action).
- `LockedOverlay` (reusable lock badge + tooltip wrapper).
- `DataTable` wrapper adding column visibility, pinning, resize, export menu on top of existing tanstack-table usage.

---

## 2. Global Shell Enhancements

- **Command Palette (⌘K)**: extend existing `GlobalSearch` into a full command palette (`cmdk`) — modules, actions, recents, pinned, saved views. Keyboard-driven.
- **TopNavbar**: keep permission gating via `useTopbarConfig`; visually redesign with hairline border, denser spacing, keyboard hint chips.
- **AppSidebar**: keep the backend-driven tree. Add:
  - Refined collapsed (icon-only) state with tooltips.
  - Pinned/favorite items section (localStorage + future API).
  - Section dividers and counter/badge polish.
- **NotificationBell**: convert to right-side drawer with grouped feed + "mark all read".
- **QuickActionsFab**: keep, restyle for consistency.
- **Global Date Picker + Saved Views**: shared context (`src/context/GlobalFiltersContext.tsx`) exposing date range + saved-view state consumed by dashboards/analytics.

---

## 3. Executive Dashboard (replaces current `/dashboard` body)

Keep `dashboardWidgetRegistry` — extend it. Add new widget kinds and register in `permissions.service.ts` mock layouts:

- `exec-overview`, `business-overview`, `network-overview`, `guest-overview`, `revenue-overview`, `security-overview`, `infrastructure-overview`, `subscription-overview`, `device-overview`, `isp-overview`
- `live-alerts`, `recent-activity-rich`, `top-locations-rich`, `critical-devices`, `system-health-rich`, `customer-growth`, `usage-analytics`, `login-analytics`, `session-analytics`

Each renders via `StatCard` + Recharts (animated on mount). Widgets remain permission/feature-flag gated and locked cleanly via `LockedOverlay`.

`SuperAdminDashboard` is refactored to consume the same registry (removing its hardcoded layout) so both admin + role dashboards share one code path.

---

## 4. Specialized Dashboards (new routes, reuse widgets)

- `/_authenticated/noc.tsx` — Network Operations Center: health tiles, live router table, heatmap, top/critical routers, offline devices. Reuses existing `monitoring` components + new widgets.
- `/_authenticated/guest-experience.tsx` — Guest journey funnel, auth success/failure, voucher/SmartID usage, peak hours, device types.
- `/_authenticated/security.tsx` — Blocked users, failed logins, OTP failures, suspicious activity timeline, audit summary.

Each is registered in `permissions.service.ts` sidebar tree under existing groups so nav stays backend-driven.

---

## 5. Location Workspace (existing) — polish only

`/workspace/locations/$locationId` already has 12 tabs. Apply:
- New `PageShell` + `SectionHeader`.
- Router actions inside the Routers tab wired to `useRouterCapabilities` — buttons only render if backend permits. Router management is removed from the master console sidebar (already gated; we ensure `routers` sidebar entry is Super-Admin-only in the mock permissions).

---

## 6. Router Details

Refactor `routers.$routerId.tsx` (kept for super admin) and the location-scoped router view to share one `RouterDetailTabs` layout with sections: Overview, Realtime, CPU/RAM/Temp, Interfaces, Traffic, Firewall, DHCP, DNS, ARP, MAC, ISP, WAN/LAN, Logs, Diagnostics. Action bar rendered from `useRouterCapabilities(routerId)`.

---

## 7. Smart Tables & Drawers

- New `DataTable` wrapper — column visibility menu, pinning, resize, CSV/PDF export, bulk actions slot, sticky header. Adopt in the highest-traffic tables first: `OrganizationTable`, `LocationTable`, `RouterTable`, `LiveSessionsTable`, `AuditTable`. Other tables continue to work unchanged and can be migrated later.
- Convert detail popups to `RightDrawer` for: Guest, Router, Location, Policy, Whitelist, Voucher.

---

## 8. Profile / Account

`/account` already has 11 sections. Redesign visuals with `PageShell` + `SectionHeader`, add missing **Devices** and **Activity** panels, ensure every action wires to existing `rbac.service` / mock endpoints.

---

## 9. Empty States, Loading, Micro-interactions

- Replace bare `EmptyState` usages with the upgraded component (illustration + CTA).
- Upgrade `LoadingSkeleton` variants: `KpiSkeleton`, `TableSkeleton`, `ChartSkeleton`, `DrawerSkeleton`.
- Framer-motion: animated counters on KPI cards, chart mount transitions, list stagger, drawer slide, sidebar collapse.
- Button/card hover elevation via new shadow tokens.

---

## 10. Custom Role Manager (RBAC polish)

Inside `/rbac`, ensure the existing role manager exposes: create, rename, duplicate, clone permissions, archive, disable, delete — all backed by existing `rbac.service` mocks (extend service where a method is missing). Permission matrix keeps 16 modules × 10 actions; visual pass only.

---

## Technical Notes

- **No route deletions.** New routes are additive; existing routes stay functional.
- **Backend-driven contract preserved.** All new widgets flow through `dashboardWidgetRegistry` + `permissions.service.ts` mock. No hardcoded sidebar items in components.
- **Feature gating.** Every new action/widget wraps in `<Can>` / `LockedOverlay`. Feature flag changes propagate via existing `permissionsBus`.
- **Type safety.** Extend `WidgetKind` union in `src/types/dashboard-layout.ts` with the new kinds; registry becomes exhaustive again.
- **Deps to add:** `cmdk` (command palette). Existing `framer-motion`, `recharts`, `@tanstack/react-table`, `sonner` cover the rest.
- **Scope discipline.** Frontend/presentation only. Services stay mock. No auth or routing rewrites.

---

## Rollout Order

1. Design tokens + shared primitives (`ui-ext/`).
2. Shell: TopNavbar, AppSidebar, Command Palette, NotificationBell drawer.
3. Executive Dashboard widgets + registry expansion + `SuperAdminDashboard` refactor.
4. NOC / Guest Experience / Security dashboards + sidebar registration.
5. `DataTable` wrapper + migrate top 5 tables.
6. `RightDrawer` migration for detail views.
7. Router Details unification + capability-driven actions.
8. Profile redesign + Devices/Activity panels.
9. Empty states, skeletons, motion polish pass.

Each step ships independently and leaves the app in a working state.
