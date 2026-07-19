# FE-024 — Location Master & NAS-Driven Workspace

Refactor the existing frontend so **Location Master** becomes the single entry point and every operational module (Voucher, Guest WiFi, Captive Portal, Analytics, Monitoring, Reports, Audit) is scoped to a **Location → NAS**. No new project, no duplicate pages — reuse existing components, services, RBAC, and design tokens.

## 1. Information architecture (sidebar rewrite)

Rewrite `src/services/permissions.service.ts` sidebar builders to the 10-item spec:

```text
Dashboard · Customers · Location Master · Infrastructure ·
Voucher Master · Policies · Analytics · Billing · Audit · Settings
```

- Collapse today's Network / Guest Mgmt / Operations groups into **Location Master** (primary) + **Infrastructure** (NAS fleet, firmware, backups).
- Existing routes are preserved but re-linked under the new groups; role-based `LOCKED_BY_ROLE` keeps Customer Admin / Location Admin restricted to their assigned Locations and NAS.
- Platform Admin sees everything; Customer Admin sees only Location Master + module tabs on assigned Locations; Location Admin sees only the single-Location workspace.

## 2. Location Master (`/locations`)

Upgrade the existing `LocationTable` into the "heart of CloudGuest":

- Columns: Customer · Organization · Location · Status · Subscription · **NAS Count** · Router Count · Guests · Bandwidth.
- Filters: Customer, Org, Country, Status, Subscription, Feature Policy.
- Row action → opens Location Details.
- "Create Location" CTA visible **only** to Platform Admin (gated via `usePermissions`).

### 10-step Create Location wizard
Extend existing `LocationWizard.tsx` to the new flow:
1. Select / create Customer
2. Select / create Organization
3. Location basics (name, property type, country, state, city, address, timezone, coordinates)
4. **Register NAS** (NAS Identifier, Router Identity, Serial, Model, RouterOS, Public IP, Private IP) — supports adding multiple NAS in one shot
5. Assign Plan
6. Assign Feature Policy
7. Assign White Label
8. Assign Customer Admin
9. Review
10. Provision (progress screen, mock)

## 3. Location Details (`/locations/$locationId`)

Replace current tab set with 11 tabs, all reusing existing panels where possible:

```text
Overview · NAS Devices · Guest WiFi · Captive Portal · Voucher ·
Users · Analytics · Monitoring · Reports · Audit · Settings
```

Each operational tab is **scoped to this Location** and shows a NAS picker at the top (defaults to "All NAS"). Selecting a NAS re-scopes the panel content.

## 4. NAS Management & NAS Details

- **NAS Devices tab** on a Location: grid of NAS cards (Identifier, Router Identity, Model, Version, Status, Traffic, Guests, CPU, RAM) + "Register NAS" for Platform Admin.
- New route `/locations/$locationId/nas/$nasId` with 13 tabs:
  `Overview · Interfaces · Hotspot · FreeRADIUS · WireGuard · Queues · Firewall · DHCP · Traffic · Logs · Backup · Terminal · Monitoring`.
- Router operations panel (Restart, Backup, Restore, Export/Push Config, Terminal, Upgrade RouterOS, Factory Reset, Delete) gated by `routerActions` from the permission envelope.

## 5. Module re-scoping

Every top-level operational route becomes a **selector shell** that forces the Customer → Location → NAS chain before rendering the module UI:

- `/vouchers` (Voucher Master), `/guests`, `/portals`, `/analytics`, `/monitoring`, `/reports`, `/audit`
- Header exposes Customer / Location / NAS filters (multi-select where relevant); body reuses the existing table/chart components with a `scope` prop.
- Direct deep-links (`/locations/$id/...`) skip the selector and pin the scope automatically.

## 6. Feature Policies & assignment

Reuse `tenant.service.ts` policy model. Add an **Assignment drawer** with scope `Customer | Location | NAS Group | Individual NAS` and a matrix of the 15 modules (Guest WiFi, Captive Portal, Voucher, QR, OTP, Social, Analytics, Reports, WireGuard, FreeRADIUS, Monitoring, Billing, White Label, API, Notifications). Assignment is surfaced from Location Master and from `/policies`.

## 7. Access model surfaces

- **User form**: add Location tree + NAS tree (checkbox multi-select) — reuse `LocationAccessTree`, add `NasAccessTree` sibling.
- Sidebar / route guards honor the assigned scope; Customer Admin & Location Admin never see the "Create Location" or "Register NAS" affordances.

## 8. Design & UX

Keep the existing enterprise design system (StatCard, PageShell, SectionHeader, RightDrawer, ComingSoonPanel). No color / token changes. All new screens use those primitives so the visual language stays consistent, responsive across desktop / tablet / mobile.

## Technical notes

- Types: extend `src/types/location.ts` with `nasDevices: NasDevice[]`, `assignedPolicyId`, `assignedPlanId`, `assignedBrandingId`, `customerAdminIds`; extend `src/types/tenant.ts::NasDevice` with `cpuPct`, `ramPct`, `trafficMbps`, `guestsOnline`, `uptimePct`.
- Services (mock): extend `location.service.ts` with `registerNas`, `listNasByLocation`, `getNas`, `runRouterOp`; extend `tenant.service.ts` with `assignPolicy(scope, targetId, policyId)`.
- Hooks: `useNasByLocation`, `useNas`, `useRouterOp` in `src/hooks/useLocations.ts` / new `useNas.ts`.
- Routing (TanStack flat filenames):
  - `_authenticated/locations.$locationId.nas.$nasId.tsx` (new)
  - `_authenticated/vouchers.index.tsx` promoted to Voucher Master shell (existing voucher route re-pointed)
  - Selector shells wrap existing `/guests`, `/portals`, `/analytics`, `/monitoring`, `/audit` bodies with a `<ScopePicker />`.
- Permissions envelope: sidebar rebuilt to the 10-item list; `LOCKED_BY_ROLE` unchanged in intent, remapped to new module IDs. Add `module: "location-master"`, `"infrastructure"`, `"voucher-master"` to `ModuleId`.
- No backend work — everything runs off the existing mock services and TanStack Query cache.

## Out of scope

- Real MikroTik integration, real RADIUS, real payments.
- Redesign of design tokens or auth flows.
- New dashboards beyond the Location-scoped Overview.
