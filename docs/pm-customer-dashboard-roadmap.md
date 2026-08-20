# Customer Dashboard Roadmap — PM Audit (2026-08-19)

Audience: the org-admin/customer dashboard (`/`, `/users`, `/reports`, `/c/*`, etc.) real
paying customers use daily — hotel, cafe, and PG owners and their staff. Not Master
Console (operator/channel-partner tooling), which is a separate product surface.

## Phase 1 — What exists today

**Full nav surface** (`src/lib/customerNav.ts` / `src/config/customerFeatureCatalog.ts`,
7 groups): Dashboard, Users, Reports, Alerts · Campaigns, Portal, Vouchers · Access
Rules, Always Allowed, Trusted Devices, Open Hours, Background Image · Devices, Guest
Groups, Staff Access · IP Addresses, Network Zones, Port Forwarding, Call Priority,
Website Blocking, Internet Connection · Notifications, Connection Tools · Support
Tickets, Logs, Network Activity Log, How It Works.

Recent ships already covered (not re-litigated below): masked per-guest identity in
reports (#66), CSV-injection/masking-bypass fixes (#67), real voucher-batch/daywise
reports (#68), multi-link-aware ISP bandwidth widget + ISP alert target (#70, #9cddf85),
Network Activity Log v1 (#79), Hindi i18n first slice (#63), captive-portal v3–v5 visual
work (#74–#91). All customer-dashboard-facing, verified against `git log`.

**Backend capability audit** (`cloud-guest-repo/backend/app/domains/*`, ~40 domains) —
checked which domains have zero frontend usage today:

| Domain | Frontend usage | Verdict |
|---|---|---|
| `router_agent` | 0 files | Correctly unexposed — device-facing protocol only (heartbeat/config-pull/action-queue), no user identity involved. Not a UI feature. |
| `readiness` | 0 files | **Deliberately not customer-facing.** Its own docstring: "per-router 'is this ready to hand to a customer' checklist" — a pre-handoff installer/Master-Console tool (RADIUS live-auth, WireGuard, DoH/DoT blocking items). Exposing this to owners would leak internal jargon and misrepresent an installer QA tool as an ongoing customer feature. Backend was merged via PR #12 on `cloud-guest-repo` main; correctly left off this dashboard. Same boundary class as the existing "no WireGuard on customer dashboard" rule. |
| `feature_entitlement` | 0 files | Billing-admin (`billing.manage` permission, keyed off `PlanFeatureKey`) — Master Console plan/entitlement management, not customer-facing. |
| `live_sessions` | 0 files (confirmed — not even the one component whose name suggested it) | Orphaned domain: `/sessions/live` with pause/resume/disconnect/extend actions, built but never wired to any frontend. Has a real bug too (`search`/`status` params accepted but never passed to the underlying query — see `service.py`). **Not chased today** — the real customer-facing gap (below) is better solved through the already-working `guest` domain endpoints this dashboard already calls successfully, not this parallel/buggy surface. Worth a backend cleanup pass separately (fix or remove) so it doesn't bit-rot further. |
| `network_diagnostics` | Exposed (Connection Tools / `debugging.tsx`) | Ping/traceroute + history, working. |
| `dns`, `qos`, `content_filtering`, `connected_devices` | Exposed | Website Blocking, Call Priority, Devices. |

## Phase 2 — Real pain points (grounded in this codebase, not generic)

Reasoning through a front-desk owner/staff member's actual day with this dashboard:

1. **The single most common real task — "a guest can't connect, get them back on" or
   "kick this guest off" — is not possible from the page staff actually use to find a
   guest.** The **Users** page (`UsersView` in `CustomerFeaturePage.tsx`) already lets
   staff search a guest by name and see phone/MAC/duration/status — but renders **zero
   row actions**. No disconnect, no extend, nothing. Staff have no way to act on what
   they just found.

   This is a shipped-but-disconnected feature, not a hypothetical gap:
   - `customer.service.ts`'s `getUsers()` already resolves each row to the *real*
     `GuestSession.id`, and its own `groupFragmentedVisits()` comment says outright:
     *"id/status/device/etc from the most recent fragment — the one 'Disconnect' (if
     online) ... should act on."* The data layer was built anticipating this action.
   - `guestService.disconnectSession` / `terminateSession` / `extendSession` already
     exist, are already proven in production use (`DebuggingView`'s "Reset a Guest
     Session" card already calls `terminateSession` successfully).
   - `HowItWorksPage.tsx`'s own copy for this page already promises it: *"If someone
     needs to be kicked off, you can disconnect them on the spot."* That sentence is
     currently false in the shipped product.

   The current workaround — Connection Tools' "Reset a Guest Session" — requires typing
   the guest's **IP address**, which front-desk staff realistically never know (they
   know a name or phone number, which is exactly what the Users page search already
   handles). This is real, high-frequency friction with a near-zero-risk fix: wire an
   already-working backend action onto an already-correct data row.

2. **Capacity planning before it becomes a complaint** — already reasonably covered.
   Alerts already supports a `connected_clients_count` threshold rule
   (`THRESHOLD_METRIC_LABEL` in `src/types/monitoring.ts`), so proactive
   "you're nearing capacity" alerting exists. Not a gap worth re-building today.

3. **Troubleshooting a router remotely** — already reasonably covered by Connection
   Tools (real ping/traceroute against the actual router + history). No further gap
   identified without adding real device I/O the backend doesn't have yet.

4. **Staff permission management / billing clarity** — Staff Access (per-feature grants)
   and the billing domain are both substantial and already exposed; no acute gap
   surfaced in this pass.

## Phase 3 — What we're shipping now

**Guest session actions (Disconnect + Extend) on the Users / Connected Guests page.**

Scope, deliberately tight:
- Add a per-row action (online/idle rows) to disconnect a guest's session, with a
  confirm dialog (mirroring `DebuggingView`'s existing confirm pattern) — calls the
  already-proven `guestService.terminateSession(sessionId, reason)`.
- Add a per-row "Extend" action (+30/+60 min) using `guestService.extendSession`,
  useful for the common front-desk case of a guest hitting a time-based limit.
- No backend changes required — endpoints exist and are already exercised elsewhere.
- No new nav/route surface — this closes the gap between what `HowItWorksPage.tsx`
  already tells customers is true and what the Users page actually does.

Explicitly out of scope for this pass (kept tight, flagged as fast-follows):
- Fixing `live_sessions`' dropped `search`/`status` params, or deciding whether that
  domain should be wired up or removed — backend cleanup, not a customer-facing gap.
- Extending guest search-by-IP in Connection Tools to also match name/phone — the
  Users-page fix above solves the real underlying need more directly.

Dispatched to a frontend engineer as a branch + PR (typecheck + lint verified, no
self-merge), same rigor as every other change today.
