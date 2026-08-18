# IPDR Logs / Syslog — Scoping Spec

Status: scoping only, not yet approved to build. Owner: PM/design (this doc).
No implementation should start from this doc alone — see "Before this ships"
at the bottom for the one sign-off it genuinely needs (compliance/legal), and
"v1 recommendation" for what's actually buildable now.

## Top-line scope decision

| Question | Verdict | Why |
|---|---|---|
| Session-level "network activity log" report | **Buildable now, this rollout.** | `GuestSession` already captures everything a session-level record needs (IP, MAC via device, timestamps, byte totals). This is a `UserReports.tsx`-pattern report, not new infrastructure. |
| True per-flow IPDR (destination IP/port/timestamp per connection) | **Not buildable today — real infra gap, separate follow-on.** | Nothing in this codebase captures per-destination-IP traffic. RADIUS accounting gives cumulative byte *totals*, never per-flow records. Needs RouterOS-side connection logging or NetFlow/IPFIX export the platform has no ingestion path for today. |
| "Compliant with DOT IPDR requirements" as a customer-facing claim | **Do not make this claim without legal sign-off.** | The 2-year retention rule is real (see below) but this platform enforces no retention floor today, and neither slice above is complete IPDR by the regulation's own definition. See "Before this ships." |
| Where it lives (Master Console vs. Customer Dashboard) | **Customer Dashboard, extending the existing "Logs" tab — not Master Console.** | The actual DOT obligation to produce these records on law-enforcement request sits on the *WiFi-service-provider* (the hotel/cafe/PG operator), not on Wyfy as the platform vendor — see reasoning below. Master Console read access for Wyfy's own ops/compliance team is a cheap additive follow-on, not the primary surface. |

---

## 1. What already exists (audited against real code, not assumed)

### Session-level metadata: real, already captured

`app/domains/guest/models.py` — `GuestSession` (append-only, one row per
continuous connection interval):

- `ip_address` (assigned IP, string, nullable — best-effort)
- `device_id` → `GuestDevice.mac_address` (MAC, globally unique per device)
- `started_at` / `ended_at` / `last_activity_at`
- `bytes_uploaded` / `bytes_downloaded` (`BigInteger`, cumulative for the interval)
- `auth_method`, `router_id`, `location_id`, `organization_id`
- `user_agent`, `accept_language` (raw headers, BE-012 additions)
- `disconnect_reason`

`GuestLoginHistory` — every login attempt, success or failure, with
`identifier`, `ip_address`, `auth_method`, `attempted_at`, `failure_reason`.
This is the closest thing to a security/audit trail the platform has for
guest-side access events.

**Confirmed: this is session-level (who, when, how much, from what device),
never flow-level (to what destination, over what port).**

### RADIUS accounting: confirmed byte totals only, never per-flow

Read `app/domains/guest/service.py`'s `RadiusService.accounting_interim_update`
and `accounting_stop`, and `GuestService.record_usage`:

```python
async def accounting_interim_update(
    self, *, nas_client, username, bytes_uploaded_delta, bytes_downloaded_delta,
) -> GuestSession:
```

Every accounting call in this codebase carries exactly two numbers —
cumulative upload/download byte deltas — sourced from RADIUS
Interim-Update/Accounting-Stop packets (RFC 2866). There is no
`destination_ip`, no `destination_port`, no per-connection record anywhere in
this flow. This matches how RADIUS accounting actually works in a real
MikroTik hotspot deployment: RouterOS reports aggregate traffic counters for
a session, not a per-flow ledger. **This confirms the task brief's
hypothesis exactly** — session totals exist, flow-level detail does not.

### No packet/flow/syslog capture anywhere in either repo

Searched both repos for `syslog`, `netflow`, `ipfix`, `traffic log`, `packet
capture`, `flow log`, `conntrack`, `dest_ip`/`dest_port`-as-a-logged-field:
zero hits outside of `network_config/renderers.py`, which only generates
RouterOS firewall/NAT *rule* scripts pushed to routers (config-push, not
logging) — e.g. `dst-address=`/`dst-port=` appear only as parameters of a
`/ip firewall filter add ...` command line the platform renders and pushes,
never as a field read back into any database table. No NetFlow/IPFIX
collector, no syslog ingestion endpoint, no DPI integration exists in this
codebase today.

### No retention-floor enforcement exists either

Searched for `retention`/`purge`/`hard_delete`/`gdpr` across the guest
domain: the only "retention" hits in the codebase are `GuestRetentionResponse`
in `app/domains/analytics` — guest *churn* retention rate, an unrelated
marketing metric, not data-retention policy. There is no scheduled purge job
touching `guest_sessions`/`guest_login_history` (good — nothing is deleting
this data), but there is also no enforced minimum-retention guarantee and no
export/law-enforcement-request workflow. Today, "the data survives" is
incidental (soft-delete via `BaseModel`, no active purge task), not a
designed compliance guarantee.

### The existing "Logs" tab is a different thing — don't conflate them

Customer Dashboard already has **Support & Logs → Logs**
(`OperationsFeatures.tsx`'s `AdminLogsView`, owner-only): three tabs —
Dashboard Logins, Router Logs, Account Activity. This is entirely about
*admin/staff* access to the dashboard and infrastructure events (who logged
into the *dashboard*, router online/offline events, role/config changes) —
backed by `app/domains/admin_logs` and `app/domains/audit`. It has **zero
overlap** with guest network traffic. An "IPDR Logs / Syslog" feature is
about *guest* WiFi usage records, a genuinely separate concern from this
existing tab, not a duplicate of it.

---

## 2. The real regulatory backdrop (not legal advice — flag this honestly)

Per DOT's Unified License security conditions (amended December 2021,
extending the prior 1-year rule to 2 years):

> Licensees must maintain **CDR/IPDR and login/logout details for internet
> access, including public WiFi**, for a minimum of **2 years**, and must be
> able to produce them to law enforcement on request. Public WiFi providers
> (hotels, cafes, restaurants, PG operators — Wyfy's actual customer base)
> are required to log usage and verify traceable subscriber identity before
> granting access.

Sources: [DoT amends UL to increase storage time of CDR, EDR, IPDR](https://www.communicationstoday.co.in/dot-amends-ul-to-increase-storage-time-of-cdr-edr-ipdr/), [DoT UL CDR two-year amendment (dot.gov.in PDF)](https://dot.gov.in/sites/default/files/21122021%20UL%20CDR%20two%20years.pdf), [Captive portals and public Wi-Fi log compliance in India — Immunity Networks](https://immunitynetworks.com/blog/captive-portal-log-compliance-india.html), [DoT reminds ISPs to comply with security conditions](https://onlytech.com/dot-reminds-isps-to-scrupulously-comply-with-security-conditions-in-isp-licenses/).

**Three honesty caveats, load-bearing for how this gets positioned:**

1. **I am not a lawyer and this is not legal advice.** The exact applicability
   of Unified License security conditions to a hotel/cafe/PG operator (vs.
   the licensed ISP/telecom operator underneath them) vs. a SaaS vendor like
   Wyfy providing the captive-portal software is a genuine legal question —
   commentary online (including the PM-WANI framework and the Immunity
   Networks writeup above) suggests the obligation to log and identity-verify
   guest WiFi users lands on the *premise operator* (the hotel/cafe), with
   the PDOA/aggregator/software vendor's role being to make that possible,
   not necessarily to independently hold the same license obligations. This
   needs real compliance/legal review before Wyfy says anything like
   "IPDR-compliant" to a customer or in marketing copy.
2. **The regulation's own definition of IPDR is flow-level, not
   session-level.** A real IPDR record (as used in telecom/ISP contexts)
   is per-session but tied to actual internet activity records including
   source/destination IP and port — closer to what this platform calls
   "flow-level" below than to a `GuestSession` row. Calling
   session-level output "IPDR" without that caveat overstates it.
3. **Whatever gets shipped needs an explicit retention decision**, not an
   implicit one. Today nothing purges `guest_sessions`, but nothing
   *guarantees* 2-year survival either (no backup/retention SLA, no
   protection against a future cleanup job deleting old rows without this
   requirement in mind). If this feature ships as a compliance-relevant
   record, retention needs to become a designed guarantee, not an accident
   of "we never got around to writing a purge job."

---

## 3. What a v1 can honestly capture, at what level

### Session-level "Network Activity Log" — cheap, real, ships now

Everything `GuestSession`/`GuestLoginHistory` already have: who connected
(guest identity, device MAC), when (start/end), from where (assigned IP),
how much data (upload/download bytes), and how they authenticated. This is
genuinely useful for troubleshooting ("why did this guest's WiFi drop") and
partially useful for a law-enforcement request ("who was assigned IP X at
time T") — but it is **not** "what website/IP did this guest visit," which
is what "security analysis of guest network traffic" or a literal IPDR
record implies.

### True per-flow IPDR — a real infra project, not a report page

To capture destination IP/port per guest per connection, one of these would
be needed, none of which exist today:

- **RouterOS connection/firewall logging** — MikroTik can log
  `/ip firewall filter` hits with `action=log` per rule, or use
  `/ip firewall connection` tracking — but this produces router-local
  syslog output that needs to be *shipped somewhere* (a syslog collector,
  or polled via the RouterOS API) and *parsed into structured per-flow rows*
  at real guest traffic volume. Nothing in `router_provisioning`/
  `router_agent`/`network_config` today pushes a logging rule set or
  ingests router syslog.
- **NetFlow/IPFIX export** — RouterOS supports NetFlow/IPFIX export to a
  collector. This platform has zero NetFlow collector, ingestion pipeline,
  or storage schema for flow records today.
- **DPI/flow-capture appliance** — out of scope entirely; this platform has
  no such capability and building one is a multi-quarter infra project, not
  a feature addition.

Any of these is a genuinely larger lift: new router-side config generation,
a new ingestion service, a new high-volume storage schema (flow records are
orders of magnitude higher-volume than session records — potentially
thousands of rows per guest session vs. one), and a 2-year retention
strategy for that volume. **This should be scoped and staffed as its own
project if the business decides real per-flow IPDR compliance is required**,
not bolted onto a reporting-page rollout.

### On the founder's framing ("network monitoring, troubleshooting, security
analysis... insights into network traffic & taking actions to maintain a
secure and efficient network")

This reads like nav-item copy lifted from a competitor's marketing page
(the "insights... taking actions to maintain a secure and efficient network"
phrasing is generic enterprise-NMS language, not specific to what this
platform can do). Grounding it: the real, buildable thing this platform can
ship is a session-level activity/security log — genuinely useful for
troubleshooting and a genuine (partial) compliance data point — not a live
network-monitoring/intrusion-detection surface implied by that copy. The v1
below is scoped to what's real, with copy that describes what it actually
does rather than matching the borrowed marketing language.

---

## 4. Where it lives: Customer Dashboard, not Master Console

The DOT obligation (to the extent it applies at all, per the legal caveat
above) sits on the **premise operator** — the hotel/cafe/PG running the
network — not on Wyfy as the software vendor. That means the party who
actually needs to pull these records for a law-enforcement request is the
customer (organization owner), the same owner-only audience the existing
"Logs" tab already serves. Building this makes most sense as a new section
alongside it, gated the same way (owner-only, real backend RBAC check, not
just a UI guard).

**Master Console fleet-wide access is a legitimate but secondary ask** —
Wyfy's own compliance team might need to help a customer who can't
self-serve, or respond to a request routed through Wyfy directly. Given the
audit found no compliance/legal workflow of that shape existing anywhere
today (no "law enforcement request" ticket type, no export/chain-of-custody
tooling), building a *parallel* Master Console view in v1 would be
speculative scope for a workflow that doesn't exist yet. **Recommendation:
ship the Customer Dashboard view first; add Master Console read access as a
narrow follow-on only if/when a real internal process for handling such
requests exists to use it.**

---

## 5. v1 recommendation: "Network Activity Log"

A new section in the Customer Dashboard's **Support & Logs** group, sitting
next to the existing "Logs" tab (distinct nav item — different data,
different audience framing) — not "IPDR Logs / Syslog" as a claim (that
name should stay reserved for if/when true per-flow capture ships), named
and described honestly:

> **Network Activity Log** — "Every guest's connection history: who
> connected, from which device, for how long, and how much data they used.
> Useful for troubleshooting connectivity issues and as a record of guest
> network activity." No claim of destination-level traffic visibility, no
> "compliance" language until legal signs off on exactly what claim (if any)
> is accurate.

This reuses `UserReports.tsx`'s established pattern almost entirely — it is
functionally a new report category (`IPDR_REPORT_TYPES` alongside
`USER_REPORT_TYPES`/`VOUCHER_REPORT_TYPES`/etc.), backed by data the
platform already has, following the same "real data or an honest
`UNAVAILABLE_REASON`, never `Math.random()`" discipline this file already
established.

### Report types (v1)

1. **Guest Session Log** — one row per session: guest identity (masked per
   existing `maskPhone`/`maskMac` convention), assigned IP, device, auth
   method, start/end, duration, bytes up/down, disconnect reason. This is
   the actual "who had IP X at time T" record a law-enforcement request
   would ask for.
2. **Login/Access Attempt Log** — one row per `GuestLoginHistory` entry:
   identifier, IP, auth method, success/failure, reason, timestamp. Captures
   failed-access attempts the session log alone wouldn't show (security
   angle: repeated failed logins from one IP/identifier).

Both need **CSV/PDF export** (the existing report panel already has
`Download`/`Printer`/`FileDown` affordances) since a real compliance/
law-enforcement handoff is export-shaped, not screen-shaped.

### What's honestly out (flag as `UNAVAILABLE_REASON`, don't fabricate)

- Destination IP/URL/domain visited — no per-flow capture exists (see §3).
- Port-level records — same reason.
- Any "security threat detected"/intrusion-style insight — no DPI, no
  anomaly detection exists; this platform can show *volume* anomalies (a
  device using far more data than typical) only if that's built as new
  analytics logic, not "IPDR" data.

---

## 6. Retention — a decision this v1 forces, not a detail to skip

Recommend, as part of this v1 (not a separate project):

- **Do not add a purge job.** (None exists; don't introduce a retention
  ceiling where none was asked for.)
- **Document, in this feature's own UI copy or a linked help article, that
  the platform does not currently guarantee a specific retention floor**,
  rather than silently implying one. If the business wants to *claim*
  2-year retention to customers, that requires a real backup/durability
  review (soft-delete alone, with no protection against e.g. a future
  cleanup migration, isn't a retention *guarantee*) — flag as a follow-on
  decision for legal + infra, not something this spec resolves.

---

## 7. BE/FE split for v1

### Backend

- **No new tables.** `GuestSession` and `GuestLoginHistory` already carry
  every field v1 needs.
- **New read endpoints** (or extend existing ones), org-scoped, owner-role
  gated, real server-side pagination + date-range filtering (mirroring
  `GET /guest-sessions`'s existing `start_date`/`end_date`/`page`/
  `page_size` contract, which `UserReports.tsx` already depends on):
  - Confirmed: `GET /guest-sessions` (`list_guest_sessions`,
    `guest/router.py:740`) already returns `GuestSessionResponse`
    (`schemas.py:299`) with everything the Guest Session Log report needs
    **except MAC address** — `ip_address`, `device_id`, `auth_method`,
    `disconnect_reason`, `bytes_uploaded`/`bytes_downloaded`,
    `started_at`/`ended_at`, `user_agent` are all already there. No new
    endpoint needed for this report.
  - **Real gap found**: `device_id` is a bare FK — there is no bulk
    `/guest-devices` list endpoint anywhere in this codebase (confirmed,
    `guest/router.py` has no such route) to resolve it to a MAC address.
    Today's dashboard has never needed this in bulk. Either add a bulk
    `GET /guest-devices?location_id=` endpoint (mirrors the existing
    `fetchRealGuestsById` bulk-join pattern `UserReports.tsx` already uses
    for guest identity), or — cheaper — denormalize `mac_address` directly
    onto `GuestSessionResponse` via a join in `list_guest_sessions` itself,
    since every session already has a `device_id` and MAC never changes
    after session creation. Pick whichever the implementing engineer finds
    less invasive; both are small.
  - **New endpoint needed, confirmed missing**: no list endpoint for
    `GuestLoginHistory` exists in `guest/router.py` today (only consumed
    internally by analytics aggregates, e.g. OTP success rate) — add
    `GET /guest-login-history?location_id=&start_date=&end_date=&page=&page_size=`
    following the exact pagination/RBAC shape `guest-sessions` already
    uses.
  - RBAC: owner-only (`RequireRole("organization-owner")`), matching
    `admin_logs`'s existing pattern exactly — this is equally
    security-sensitive data.
- **No changes to RADIUS accounting, session models, or router config
  generation** — this is a pure read/reporting slice on existing data.

### Frontend

- New report category in `UserReports.tsx` (or split into its own
  component if the file is judged too large already — check current line
  count/team convention at implementation time): `NETWORK_ACTIVITY_REPORT_TYPES`
  with the two report types from §5, following the exact
  `REAL_REPORT_TYPES`/`UNAVAILABLE_REASON`/masked-column/CSV-export
  conventions already established in that file.
- New nav entry under **Support & Logs** in `customerNav.ts` (owner-only,
  `roles: ["owner"]`, matching "Logs"'s own gating) — e.g.
  `{ id: "network-activity", label: "Network Activity Log", icon: Radar (or similar), roles: ["owner"] }`.
  Do not merge into the existing `admin-logs` tab (different data, different
  framing, would bury a compliance-relevant record inside an
  infra/dashboard-access log).
- Render-time owner-only guard mirroring `AdminLogsView`'s existing
  defense-in-depth pattern (sidebar filter + render check + backend RBAC,
  three independent layers, not just one).

### Explicitly not in v1 (separate proposal if pursued)

- Any NetFlow/IPFIX/syslog ingestion pipeline.
- Any RouterOS-side connection-logging config push.
- Master Console fleet-wide view (until a real internal law-enforcement-
  request workflow exists to justify it).
- Any "IPDR compliant" or "DOT compliant" claim in product copy — pending
  legal review.

---

## Before this ships

1. **Legal/compliance review** of exactly what claim (if any) Wyfy can make
   about this feature relative to DOT's Unified License security conditions
   — including whether the obligation even lands on Wyfy vs. the customer,
   and what "2-year retention" would actually require infra-side to back up
   as a real guarantee rather than an accident of no purge job existing.
2. **Naming decision**: recommend shipping as "Network Activity Log" (or
   similar honest name) for v1, reserving "IPDR Logs" as a label for if/when
   true per-flow capture is built — using the compliance term for a
   session-level report risks the platform being held to a definition it
   doesn't meet.
