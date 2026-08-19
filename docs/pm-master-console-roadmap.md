# Master Console Roadmap — PM Audit (2026-08-19)

Audience for this document: Wyfy's own internal staff tool (`/master/*`),
used by platform ops/support/sales/billing/network-admin staff to run the
business — not the customer-facing dashboard, not the marketing site (those
are two other teams' lanes today; this roadmap stays out of both).

## Phase 1 — What's actually here today

A full read of `MasterShell.tsx`'s real nav (15 destinations), the RBAC
model (`app/domains/rbac/{seed,router,service}.py` — 15 system roles, 56
permission modules, a real `GET/POST/DELETE /users/{id}/roles` assignment
API), and every `master.*.tsx` route's own module comments (several of
which are themselves recent, evidence-backed audits) found this console in
much better shape than a typical "day 1" internal tool:

**Genuinely real, live-data, no action needed:**
- Platform Overview, Customers (incl. a real one-transaction "smart
  provisioning" wizard: org + first location + first router + plan + owner
  account), Channel Partners (shipped today, incl. revoke), Billing &
  Subscriptions (9 of 10 old tabs real, already trimmed to 3 workflow
  groups), Support Tickets (real-time via WebSocket, reply threads, status
  lifecycle), Router Fleet (1700+ lines: per-router Overview / Setup
  Script / WireGuard / WiFi / Devices / Monitoring / Analytics / Config /
  Provisioning / Diagnostics / Audit tabs, all wired to real endpoints),
  Device Console (raw RouterOS command execution, audited, confirm-to-run),
  System Health (real dependency checks), Audit Logs (1,000+ real rows,
  filters, timeline, login history), Global Analytics (already triaged by a
  prior session — fake tabs *cut*, not hidden, with an honest paper trail).
- Platform Settings was similarly cleaned up recently: it now shows real
  GLOBAL-scope roles and links out to the real Billing/NAS/Audit pages
  instead of duplicating them. Its own module comment is explicit about
  what's *honestly* left out (white-label, platform API keys, notification
  routing) because those concepts have no GLOBAL-scope backend yet — a
  product decision, not a wiring gap.

**Confirmed real gap:**
- **No internal staff/operator access management UI exists anywhere in the
  Master Console.** `master.settings.tsx` lists the GLOBAL-scope *roles*
  that exist (Super Admin, Platform Admin, Platform Support, Billing
  Manager, …) but there is no page showing **who** holds them, no way to
  invite a new internal hire, no way to change someone's role, and no way
  to revoke access when someone leaves. This is a pure frontend gap, not a
  backend one — confirmed by reading the actual service code:
  - `UserService.list_users()`: *"Platform-level callers (no
    `requesting_organization_id` — a GLOBAL-scoped role) see every user."*
  - `POST /users/{id}/roles` (`assign_role_to_user`) and `DELETE
    /users/{id}/roles/{assignment_id}` (`revoke_role_from_user`) already
    exist and already support `scope_type: "global"`.
  - The customer-dashboard's own `/_authenticated/rbac` page already has
    every component this needs, built and working at ORGANIZATION scope:
    `UserTable` (with a "Manage roles" row action), `AssignRoleDialog`
    (its `SCOPE_OPTIONS` already include `"global"`), `UserFormDialog`,
    `InviteUserPanel`, `useRbacUsers`/`useAssignRole`/
    `useRevokeRoleAssignment`/`useDeactivateUser` hooks — none of which
    send an org header unless one is already in context, the same
    "absent header → GLOBAL scope" pattern every other Master Console page
    already relies on (Audit, Health, Analytics).

## Phase 2 — Real pain points, ranked

1. **No way to onboard/offboard Wyfy's own staff on this console.**
   Today, granting a new support hire "Platform Support" access or revoking
   a departed employee's "Super Admin" grant has no self-service path in
   the product Wyfy itself ships to run its own business — it would need a
   direct DB/API call. This is a genuine security/compliance gap (the same
   category of work as today's secret-rotation and firewall-lockdown
   passes) and a genuine onboarding-friction gap, and it's the one item
   this audit found with zero real UI anywhere, high real-world urgency, and
   a fully-built backend + component library already sitting behind it.
   **→ Building this now (see Phase 3).**

2. **Fleet-wide "what needs attention" triage.** Router Fleet has rich
   per-router detail (diagnostics, monitoring, config history) but no
   fleet-wide view sorted/filtered by "needs attention" (WAN down, stale
   heartbeat, RADIUS unreachable) — an operator has to already know which
   router to look at. Real, but lower urgency than #1 since Device Console
   + per-router Monitoring/Diagnostics tabs already cover the "diagnose a
   specific router" case reasonably well once you know which router.
   Backlog.

3. **Customer → Billing deep link.** The Customer detail drawer's "Edit
   Plan" button navigates to `/master/billing` with no org context, so the
   operator has to re-find the customer in the billing table. Small, real,
   low-effort UX gap. Backlog / good first fast-follow.

4. **Support ticket ↔ router/location health correlation.** A ticket's
   drawer shows the customer and description but not that customer's
   current router/WAN status — an operator triaging "guest wifi down"
   still has to jump to Router Fleet and search. Real, but a bigger lift
   (needs a location→router lookup + a compact health summary component);
   backlog.

5. **Global Analytics org/location drill-down.** Already flagged by a
   prior session's own audit as a known, deliberate gap (needs an
   org/location selector, a frontend scope decision, not a backend one).
   Not re-litigated here — deferred, as that audit already recommended.

## Phase 3 — What's being built today

**Team & Access** (`/master/operators`) — a new Master Console page for
managing who has platform-level (GLOBAL-scope) staff access:
- List every platform user and their current role assignment(s), reusing
  the existing `UserTable` + `AssignRoleDialog` components unscoped (no
  `X-Organization-Id` header → GLOBAL, the same pattern already proven on
  Audit/Health/Analytics).
- Invite a new internal operator (`InviteUserPanel`/`UserFormDialog`,
  already real) and assign them a GLOBAL role on the spot.
- Change or revoke an existing operator's role (`AssignRoleDialog`'s
  existing "revoke" action) and deactivate their account entirely
  (`useDeactivateUser`) — the same onboard/revoke shape as today's Channel
  Partner work, applied to Wyfy's own staff instead of partners.
- Gated behind a new `operators` capability in `MASTER_NAV`/
  `CAP_PERMISSIONS` (`users.read` to view, `users.manage`/`roles.assign`
  for the mutating actions), added to the "Operations" nav group next to
  Audit Logs and Platform Settings.

Scoped as composition over new build: every component and endpoint this
needs already exists and is already in production use at ORGANIZATION
scope; the work is a new route + capability wiring + confirming GLOBAL
scope end-to-end, not new backend or new base components. Dispatched to a
frontend engineer with real typecheck/test/PR verification, no self-merge.

**Not in this pass** (items #2–5 above): real, tracked, intentionally
deferred to keep this sprint's scope tight and non-duplicative of the
website and customer-dashboard teams' parallel work today.
