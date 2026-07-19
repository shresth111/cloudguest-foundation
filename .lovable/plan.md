
# FE-025 — Platform Console (Super Admin Only)

Refactor the existing CloudGuest console so the Super Admin experience is a **pure platform / provisioning cockpit** (Meraki / Aruba Central / Azure Portal style). Operational modules (Guests, Voucher, Portal, Analytics, Monitoring, Reports, Radius Users, Staff) stay in the **Location Workspace** and are removed from the Super Admin sidebar. No new project, reuse existing services, hooks, and design primitives.

## 1. Sidebar rewrite (Super Admin only)

Rewrite the Super Admin sidebar builder in `src/services/permissions.service.ts` to exactly 12 items, in this order:

```text
Dashboard · Customers · Location Master · NAS Management ·
NAS ID Generator · Policies · Plans & Billing · Feature Catalog ·
White Label · Infrastructure · Audit Logs · Platform Settings
```

- Remove from the Super Admin envelope: `guests*`, `portals`, `vouchers`, `voucher-master`, `analytics*`, `monitoring`, `reports`, `network-monitoring`, `isp-monitoring`, `guests-live/sessions/blocklist`, `workspace-*`, `campaigns`, `smart-id`, `whitelist`, `radius`, `mac-auth`, `mac-bypass`, `web-filter`, `otp`, `survey`, `premium-wifi`, `captive-portal`, `guest-login`.
- Customer Admin / Location Admin envelopes are unchanged — they keep operational modules inside their Location Workspace.
- Add new `ModuleId`s in `src/types/permissions.ts`: `nas-management`, `nas-id-generator`, `feature-catalog`, `plans-billing`.

## 2. Platform Dashboard

Replace `SuperAdminDashboard.tsx` with a platform-only view. Remove Guest / Auth / Device / Top-Orgs-by-guests widgets; add platform KPIs and charts:

- KPI grid (10 cards via `StatCard`): Total Customers, Total Organizations, Total Locations, Registered NAS, Online NAS, Offline NAS, Active Subscriptions, Monthly Revenue, License Usage %, Platform Health %.
- Charts: Customer Growth, Subscription Growth, Revenue, NAS Registration, Location Provisioning (reuse Recharts primitives already in `DashboardCharts.tsx`; drop guest / device / auth charts).
- Recent Activity feed: New Customer, New Location, NAS Registered, Plan Changed, Policy Assigned (single unified widget backed by `superadmin.service.ts`).
- Alerts panel: Offline NAS, Expiring Plans, License Expiry, Failed Provisioning.

Extend `superadmin.service.ts` mock feeds accordingly (new fields on KPI payload, new `getPlatformActivity`, `getPlatformAlerts`, `getNasRegistrationTrend`, `getLocationProvisioningTrend`, `getSubscriptionGrowth`).

## 3. Customers

Keep existing `/customers` table + detail; ensure Super-Admin-only actions (Create, Suspend, Activate, Delete) render via `<Can />`. Detail tabs reduced to the platform set: Overview · Locations · Subscription · Feature Assignment · White Label · Billing · Usage · Audit. Remove operational tabs if present.

## 4. Location Master

Reuse existing `/locations` route and `LocationTable`. Column set for Super Admin only:

```text
Location · Customer · Organization · Current Plan · Plan Expiry ·
NAS Count · Status · Provision Status · Created · Actions
```

Row actions gated behind `<Can module="location-master" action="…">`: View, Edit, Suspend, Activate, Delete, Upgrade Plan, Downgrade Plan. Extend `src/types/location.ts` with `currentPlanId`, `planExpiry`, `provisionStatus` and surface them from `location.service.ts` mock.

Create Location Wizard already covers steps 1–10 (FE-024); confirm labels match the FE-025 spec and adjust step titles only if drifted.

## 5. NAS Management (`/nas`)

New route `_authenticated/nas.index.tsx` — cross-location NAS inventory table:

```text
Friendly Name · NAS Identifier · Router Identity · Customer · Location ·
Model · RouterOS · Public IP · Status · Last Seen · Actions (View / Replace / Disable / Delete)
```

Backed by a new `nas.service.ts::listAllNas()` mock that flattens NAS across locations. Row click → existing `/locations/$locationId/nas/$nasId` detail.

## 6. NAS ID Generator (`/nas/id-generator`)

New route with a small workbench:

- Auto Generate (city code + zero-padded sequence, e.g. `NAS-DEL-0001`) — reserves the next free ID.
- Manual Generate with live validation against the reserved / used registry.
- Reserved IDs table (Reserve / Release / Assign to location).
- Duplicate prevention via `nas.service.ts::isNasIdAvailable(id)`.

## 7. Plans & Billing (`/plans`)

Merge existing plans + subscription views under one route:

- Plan catalog cards (Starter / Business / Enterprise / Custom) with edit dialog.
- Per-Location subscription table: Location · Customer · Current Plan · Renewal · Expiry · Usage · Actions (Upgrade / Downgrade / Suspend / Resume / Invoice).
- Reuse `billing.service.ts` and extend with `listLocationSubscriptions()`.

## 8. Feature Catalog (`/feature-catalog`)

New route listing every platform module with Enable / Disable / Assign controls. Uses existing feature-flag + `tenant.service.ts` policy model. Assign drawer scopes to Customer / Location / NAS Group / Individual NAS (reuse the FE-024 assignment drawer).

## 9. White Label

Keep `/branding`. Ensure it's Super-Admin-only in the console (Customer Admin manages their own branding inside Workspace, not here).

## 10. Infrastructure (`/infrastructure`)

New route aggregating platform health:

- Overview tiles: Registered Routers, NAS Inventory, WireGuard, FreeRADIUS, Redis, Database, API Services, Queue Workers, Storage.
- Each tile shows status (Healthy / Degraded / Down), latency, and last check.
- Reuse `monitoring.service.ts` primitives; add `getInfrastructureHealth()` mock.

## 11. Audit Logs & Platform Settings

`/audit` and `/settings` already exist — verify they're Super-Admin-only and prune any operational filters (guest events, voucher events) from the Super Admin view.

## 12. Permission envelope hardening

In `permissions.service.ts`:

- Super Admin: full access to the 12 platform modules above; operational modules explicitly **omitted** from the envelope (not just locked) so they cannot appear in sidebar or via deep-link.
- Customer Admin: existing envelope untouched — never sees Current Plan, Upgrade / Downgrade, Provision Status, Infrastructure, NAS ID Generator, Feature Catalog, Platform Settings.
- Location Admin: unchanged.
- Add route guards: any Super-Admin-only route (`/nas`, `/nas/id-generator`, `/feature-catalog`, `/infrastructure`, `/plans`) checks `role === 'super_admin'` in `beforeLoad` and redirects otherwise.

## Out of scope

- Real MikroTik / RADIUS integration.
- Any change to the Location Workspace (operational modules stay exactly where they are).
- Design-token or auth-flow changes.

## Technical notes

- Types: add `ModuleId`s (`nas-management`, `nas-id-generator`, `feature-catalog`, `plans-billing`); extend `Location` with `currentPlanId`, `planExpiry`, `provisionStatus`; add `NasReservation` to `src/types/tenant.ts`.
- Services (mock): extend `superadmin.service.ts`, `nas.service.ts` (`listAllNas`, `generateNasId`, `reserveNasId`, `isNasIdAvailable`), `billing.service.ts` (`listLocationSubscriptions`), `monitoring.service.ts` (`getInfrastructureHealth`).
- Routes (flat filenames):
  - `_authenticated/nas.index.tsx`
  - `_authenticated/nas.id-generator.tsx`
  - `_authenticated/feature-catalog.index.tsx`
  - `_authenticated/infrastructure.index.tsx`
  - `_authenticated/plans.index.tsx` (upgrade existing)
- Dashboard: rewrite `SuperAdminDashboard.tsx`, retire guest-oriented widgets from Super Admin render path (keep components for Workspace use).
