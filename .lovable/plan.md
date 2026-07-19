## Goal

Evolve the existing frontend into a fully backend-driven multi-tenant permission engine. No rebuild — extend the current permissions layer, workspace context, sidebar, topbar, profile menu, dashboards, and action buttons so every visible element is resolved from API responses (permissions, feature flags, tenant hierarchy, router capabilities). Adds the missing hierarchy layer (Business Unit), the post-login space selection chain, and reactive location-context invalidation across every module.

## What already exists (keep and extend)

- `src/types/permissions.ts` — module actions, feature flags, router actions.
- `src/services/permissions.service.ts` + `usePermissions` — returns `SidebarNode` tree, `can()`, `hasFeature()`, `canRouterAction()`.
- `src/components/permissions/Can.tsx` — `<Can />`, `<LockedBadge />`.
- `AppSidebar.tsx` — renders API tree via `resolveIcon`.
- `WorkspaceContext.tsx` — invalidates query caches on location change.
- `/select-space`, `/account` (8 tabs), `TopNavbar`, `SpaceContextChip`, `QuickActionsFab`.

Nothing above is replaced. All work is additive or in-place refactors.

## Plan

### 1. Hierarchy + Space Selection (Org → BU → Location)

- Extend `src/types/tenant.ts` with `BusinessUnit { id, orgId, name, region }` and add `businessUnitId` to `Location`.
- Extend `permissions.service.ts` mock to return `assignedOrganizations`, `businessUnits[]` per org, and `locations[]` per BU (respecting scope: Regional/Area/IT managers see only their subset).
- Refactor `/select-space` into a 3-step chooser (Org → BU (skipped if 0/1) → Location) with searchable cards, favorites, recents — reuse existing card UI.
- `WorkspaceContext` gains `organizationId`, `businessUnitId`, `locationId`; setting any upper level clears lower ones and re-fetches the permission tree.

### 2. Permission tree is the single source of truth

- Every fetch of the sidebar, dashboard layout, quick actions, topbar chips, and router controls keys on `[permissions, orgId, buId, locationId]`.
- On location change, `WorkspaceContext` invalidates the added keys (`dashboard-layout`, `quick-actions`, `topbar-config`, `router-capabilities`, plus existing modules).
- Add `permissions.service.getDashboardLayout(locationId)` returning ordered widget descriptors `{ id, type, module, size, permissionRequired }`; `SuperAdminDashboard` and `CustomerDashboard` iterate this list instead of rendering hardcoded widget arrays. Existing widget components are reused as a registry (`dashboardWidgetRegistry`).
- Add `permissions.service.getTopbarConfig()` — profile/notifications/search/quick-actions/theme/language/support each gated by a flag.

### 3. Router-level dynamic actions

- Router detail pages read `permissions.service.getRouterCapabilities(routerId)` returning allowed actions from the existing `RouterAction` union.
- Each action button wraps in `<Can routerAction="reboot">…</Can>`; disallowed ones render `<LockedBadge>` with the standard "Access restricted. Contact your Administrator." tooltip.

### 4. Custom Role Engine (Customer Admin)

- New panel under existing `/rbac` (not a new route): `CustomRoleManager` supporting Create / Rename / Duplicate / Clone permissions from / Archive / Disable / Delete on top of existing `rbac.service.ts`.
- Uses the current `PermissionMatrix` component; adds row/column bulk toggle and per-module action grid (View/Create/Edit/Delete/Export/Import/Approve/Execute/Restart/Configure) to match the expanded action set.

### 5. Feature Flags reactivity

- `usePermissions` already returns `featureFlags`. Add a lightweight pub/sub (`permissionsBus`) so a mock "flag change" (dev toggle + future websocket) triggers `queryClient.invalidateQueries(['permissions'])` — sidebar/widgets/actions re-render without reload.
- Add dev-only Feature Flag inspector inside `/system` (existing route) to simulate backend toggles.

### 6. Locked-feature UX

- Standardize `<LockedBadge />` tooltip copy and apply it to sidebar nodes flagged `locked: true`, dashboard widgets, and router actions. Never hide unless backend sets `hidden: true`.

### 7. Profile Menu completion

- Extend existing `UserMenu` to expose all 11 entries (Profile, Company, Security, Change Password, 2FA, Login History, API Tokens, Sessions, Preferences, Notification Settings, Logout), each linking to the existing `/account/*` tabs; add missing `Company` and `Preferences` tabs to the account module using the existing panel layout.

### 8. Polish

- Framer Motion fade/slide on sidebar tree diff, widget grid reflow, and topbar chip swap when location changes.
- Skeletons already exist — wire `PageSkeleton` into the permission-loading state so no flicker during location switch.

## Technical notes

- All new data lives behind `permissions.service.ts`, `tenant.service.ts`, `rbac.service.ts` mocks — no new context providers beyond extending `WorkspaceContext`.
- Query keys namespaced `['perm', orgId, buId, locationId, …]` to guarantee scoped invalidation.
- Strict TS; new descriptors typed in `src/types/permissions.ts` and `src/types/tenant.ts`.
- No route deletions; new panels mount inside existing routes (`/rbac`, `/account`, `/system`, `/select-space`).

## Out of scope

- Real backend, websockets, actual auth provider — mocks only, shaped for drop-in API replacement.
- No visual redesign of existing modules beyond the motion/skeleton polish above.
