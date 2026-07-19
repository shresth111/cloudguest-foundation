## Customer Workspace (FE-020)

Goal: give Org-Admin / Location-Manager roles a unified workspace scoped to a single customer, without duplicating existing modules. Super-Admin keeps today's cross-tenant view; the new shell is a sibling that reuses the same services, queries, forms, and shadcn components.

### Scope boundaries (what this task does NOT touch)

- No new routing framework, auth, RBAC, theme, or API layer.
- No changes to existing pages (`/dashboard`, `/locations`, `/routers`, `/guests`, `/audit`, `/billing`, `/analytics`, `/settings`, `/customers`, etc.) — they stay as-is for Super-Admin.
- No new backend. Everything runs off the existing mock services (`customer.service`, `location.service`, `router.service`, `guest.service`, `billing.service`, `audit.service`, `superadmin.service`, `rbac.service`).

### Architecture

New pathless layout `src/routes/_authenticated/_workspace.tsx`:
- `beforeLoad` gate: only `org_admin`, `location_manager`, `read_only` land here (Super-Admin is redirected to `/customers`).
- Provides `WorkspaceContext` with the resolved customer + active location scope.
- Renders a workspace-specific sidebar and header while keeping the app's existing outer chrome (`SidebarProvider`, theme, notifications).

Active-location state is a URL search param (`?loc=<id>` or `all`) on every workspace route — persistable, shareable, matches the pattern we already use for Customers filters. A `useActiveLocation()` hook reads/writes it and derives filtered query keys.

### New files (all under `src/…/workspace/`)

Routes (`src/routes/_authenticated/_workspace/`):
- `route.tsx` — layout + gate + context.
- `index.tsx` → `/workspace` — Customer Dashboard.
- `locations.tsx` — grid + tree of the customer's properties.
- `routers.tsx` — routers overview scoped to active location.
- `guests.tsx` — guests overview scoped to active location.
- `staff.tsx` — staff rollup by role.
- `analytics.tsx` — customer analytics.
- `reports.tsx` — report generator + export.
- `billing.tsx` — plan / invoices / usage.
- `notifications.tsx` — notification center.
- `audit.tsx` — timeline + filters.
- `company.tsx` — Customer Profile (10 tabs: Overview, Company, Business, Locations, Subscription, Billing, Feature Access, API Keys, Branding, Audit).
- `help.tsx` — help center.

Components (`src/components/workspace/`):
- `WorkspaceSidebar.tsx`, `WorkspaceHeader.tsx`, `LocationSwitcher.tsx`, `WorkspaceCommandPalette.tsx` (⌘K).
- `dashboard/SummaryCards.tsx`, `DashboardCharts.tsx`, `RecentActivity.tsx`, `QuickActions.tsx`.
- `locations/LocationGrid.tsx`, `LocationCard.tsx`, `LocationTree.tsx`.
- `staff/StaffOverview.tsx`, `guests/GuestOverview.tsx`, `routers/RoutersOverview.tsx`.
- `company/CompanyTabs.tsx` + tab panels.
- `common/WorkspaceEmpty.tsx`, `WorkspaceError.tsx`, skeletons.

Hooks: `src/hooks/useWorkspace.ts` — `useActiveCustomer`, `useActiveLocation`, `useWorkspaceScope`. Wraps existing query hooks and injects the active-location filter.

### Reuse map (no duplication)

- Location grid / tree → uses `useCustomer(customerId)` + existing `location.service`.
- Routers overview → wraps `useRouters` filtered by scope; drills into existing `/routers/$routerId`.
- Guests overview → wraps `useGuests` + existing session components.
- Analytics → embeds existing `AnalyticsKpiGrid`, chart panels from `analytics/`.
- Reports → embeds existing `ReportCenter`, `CustomReportBuilder`.
- Billing → embeds existing `SubscriptionTable`, `RevenueAnalyticsPanel`.
- Audit → embeds `AuditTable`, `ActivityTimeline`, `AuditDetailsDrawer`.
- Company Profile → embeds branding editor, feature-access grid, and existing customer detail panels.
- Command palette → same `GlobalSearch` primitive, filtered to customer scope.

### Sidebar / nav

`src/lib/roles.ts` gets a new `WORKSPACE_NAV_ITEMS` list (Dashboard, Locations, Routers, Guests, Staff, Analytics, Reports, Billing, Notifications, Audit, Company Settings, Help). Existing `NAV_ITEMS` is untouched. Post-login redirect (`src/lib/roles.ts` role→home map) sends non-Super-Admin roles to `/workspace`; Super-Admin still lands on `/dashboard`.

### RBAC

Sidebar items filtered via existing `hasRole` helpers on `AuthContext`. Buttons like "Register Router", "Invite Staff", "Upgrade Plan" gated by role. Read-only role hides mutating actions.

### States

Every route ships skeleton, empty (`Welcome to CloudGuest → Create Location`), and error (retry via `router.invalidate()`) variants using the existing `LoadingSkeleton` / `WorkspaceEmpty` / toast primitives.

### Responsiveness

Reuses existing `SidebarProvider` collapse behaviour. Grid → 1/2/3 col at sm/md/xl. Data tables use existing horizontal-scroll wrappers. Charts use `ResponsiveContainer` as elsewhere.

### Out of scope (explicit)

- No new mock data seeds beyond thin selectors over existing customer/location/router/guest data.
- No new payment/webhook plumbing.
- No changes to Super-Admin routes or the Customers 360 page.

### Delivery order

1. Layout, context, sidebar, header, location switcher, role gating, post-login redirect.
2. Dashboard (summary cards, charts, recent activity, quick actions, command palette).
3. Locations grid + tree, Routers/Guests/Staff overviews.
4. Analytics, Reports, Billing, Notifications, Audit (embedding existing modules).
5. Company Profile tabs + Help Center + empty/error polish.

Approve and I'll implement in that order in a single pass.
