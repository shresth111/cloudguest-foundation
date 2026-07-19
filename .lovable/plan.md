# CloudGuest V2.1 — Enterprise Redesign & New Modules

Scope: redesign the existing shell, reorganize navigation into the new IA, and ship four new module groups (VLAN, Location/User/Group Policies, RBAC enhancements, Profile). No existing functionality removed — new routes are added and the sidebar is regrouped to point at them.

## 1. Design system polish (no rebuild)

Edits to `src/styles.css` and shared primitives in `src/components/ui-ext/`:
- Tighten spacing scale, upgrade elevation ramp, add `--surface-1/2/3`, refine border tokens, subtle grid/dot background utility for empty states.
- Sidebar: denser vertical rhythm, group label uppercase tracking, active-row left accent bar, section dividers.
- New primitives: `DataToolbar`, `SmartTable` (wraps existing table with search/filter/export slots), `EmptyState` variant, `SkeletonBlock`, `PageHeader` (title + description + actions + breadcrumbs slot).
- Cards: rounded-2xl, hairline border + soft shadow, hover lift.
- Charts: consistent axis/tooltip theming via a `chartTheme.ts` helper.

## 2. Information architecture

Rewrite `permissions.service.ts` sidebar generator to emit these groups (console context):

```text
Dashboard
Network        → Routers, Access Points, VLAN, ISP, WAN, LAN, DSCP, Firewall, DHCP, DNS
Guest Mgmt     → Live Guests, Sessions, Smart ID, Voucher, Whitelist, Blocklist
Policies       → Location, User, Group, Authentication, Bandwidth, Network
Analytics      → Executive, Network, Guest, Device, ISP
Operations     → Device Monitoring, Alerts, Audit Logs, Admin Logs
Administration → Organizations, Business Units, Locations, Users, Roles, Feature Assignment, Billing, Subscription
Support        → Help Center, Documentation, Contact Support
```

Existing routes are reused where they exist; new routes are added as thin pages that render new or existing panels.

## 3. VLAN module (new)

- `src/types/vlan.ts`, `src/services/vlan.service.ts` (mock), `src/hooks/useVlan.ts`.
- Route `/_authenticated/network/vlan.index.tsx`: SmartTable with search, filters (status/location/ISP), bulk actions, CSV export, history drawer, audit trail tab.
- `VlanWizard` (create/edit/clone) with fields: name, id, description, subnet, gateway, DNS, DHCP range, ISP mapping, status, notes.
- Assignment drawer: assign to Location / Router / SSID / User Group / Guest Policy / Business Unit (multi-select).

## 4. Policy modules (new)

Shared `src/services/policy.service.ts` + `src/types/policy.ts` covering Location, User, Group policies.

- **Location Policy** `/policies/location`: table + wizard (Bandwidth, Session/Idle Timeout, Device/Guest limits, Auth Method, Captive Portal, Voucher, Smart ID, Landing Page, Redirect URL, Up/Down limits, QoS, Network Access), clone/archive, multi-location assign drawer.
- **User Policy** `/policies/user`: table + wizard, user-type presets (Guest/Staff/VIP/Temporary/Employee/Student/Resident), daily/weekly/monthly quotas, auth (Smart ID / Voucher), restrictions.
- **Group Policy** `/policies/group`: 6-step wizard (Create Group → Configure Policy → Assign VLAN → Assign Locations → Assign Users → Review), clone/archive, bulk assignment, policy comparison view.
- **Authentication / Bandwidth / Network Policy** pages: use the same shared table primitive with policy-type filter.

## 5. RBAC enhancement

- Extend `RBAC_MODULES` in `src/types/rbac.ts` with: Campaigns, ISP, VLAN, DSCP, Firewall, Location Policies, User Policies, Group Policies, Whitelist, Voucher, Smart ID, Radius, Device Monitoring, Notifications.
- Add `restart` to `PERMISSION_ACTIONS` (already has view/create/edit/delete/approve/export/publish/configure — swap `publish` label unchanged, add `execute` + `restart`).
- Redesign `RoleFormDialog` permission matrix: grouped accordions per domain, "All view / All manage" quick-toggles, plain-language descriptions per module (non-technical), search box, "copy from role" shortcut.

## 6. Profile & Settings

Refresh `/account` sections to a consistent card grid: Profile, Company, Security, 2FA, Password, Sessions, API Tokens, Notification Settings, Theme, Language, Timezone. Reuse existing panels where they exist; add missing Theme/Language/Timezone panels wired to `ThemeContext` and mock user prefs.

## 7. Guardrails

- All new pages permission-gated with `<Can>` and appear in sidebar only via the permissions service.
- Mock data only; services expose CRUD signatures ready for API swap.
- No removal of existing routes — the current `/rbac`, `/locations`, `/routers`, `/monitoring`, `/analytics`, `/audit`, `/billing`, `/subscription`, `/help`, `/notifications`, `/organizations` pages remain and are linked from the new groups.

## Technical notes

- Sidebar reorg is entirely data-driven from `permissions.service.ts::buildSidebar`; no `AppSidebar.tsx` changes needed beyond styling.
- Where a new group item points at an unimplemented deep page (e.g. Access Points, WAN, LAN, DHCP, DNS, Business Units, Feature Assignment, Documentation), add a lightweight route that renders a `ComingSoonPanel` primitive (real header, description, permission-aware CTA) — not a dead link.
- Estimated ~40 new files, ~15 edits. Delivered in one pass with parallel writes.
