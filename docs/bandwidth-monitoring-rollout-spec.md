# Bandwidth / ISP Monitoring — Rollout Spec

Status: ready to implement. Owner: PM (this doc). Implementers: 1-2 BE
engineers, 1-2 FE engineers, 1 network engineer with real router/fleet
access.

## Top-line finding

The `app/domains/isp/` backend and the "Internet Connection" customer
view are **far more built-out than the brief assumed**. This is not a
green-field "add multi-ISP support" project — multi-ISP-per-router,
automatic failover/failback (3-consecutive-failure threshold), on-demand
real speed tests, per-link bucketed history (uptime *and* bandwidth
charts), manual status override, and a full, separate Alert/Notification/
Incident/SLA engine (`app.domains.monitoring`, BE-011 Part 2) already
exist and already work. The dashboard widget that was verified today is
the smallest, simplest surface in this whole system.

The real problems are three specific **seams where a genuinely mature
backend capability never got wired to where a venue owner would actually
touch it**, plus one **architectural fact that needs empirical
verification, not more dashboard polish**:

1. A router that finishes provisioning today has real, working dual-WAN
   failover on the device and **zero rows in `isp_links`** — monitoring,
   the dashboard widget, and alerting are all silently off until someone
   manually re-enters the same ISP a second time in a different screen.
2. The backend's Alert Engine already supports "alert me when an ISP
   link goes down" (`ALERT_TARGET_ISP_LINK`) end to end — email, SMS,
   Slack, Teams, Discord, webhook — and **the Alert Rules UI never
   offers it as an option**. A venue owner cannot configure the single
   most obviously-wanted notification ("tell me when my internet goes
   down") even though the plumbing for it has existed for a while.
3. The one screen every admin actually looks at daily (dashboard home)
   only ever shows **one** ISP link, even when a location has a primary
   + backup configured. The full multi-link view exists — it's just one
   click away, on a page nobody opens unless something's already wrong.
4. `IspService.trigger_failover`/`trigger_failback` — both the manual
   button and the automated 3-failure trigger — **only flip a database
   column**. They never open a device connection. This is a deliberate,
   documented design (`models.py`'s own docstring: "read/observe-only...
   never pushes real config to a router"), not a bug — real failover is
   expected to already be happening independently via RouterOS's own
   `check-gateway=ping` routes, set up once at provisioning by the
   setup-script generator. Nobody has verified, on real hardware, that
   these two independent mechanisms actually agree with each other.

Everything below is organized around closing exactly those four gaps,
plus a short list of small, genuinely cheap wins found along the way,
and an explicit list of things that look like gaps but are **already
built** or **deliberately, correctly out of scope**.

---

## Current-state audit

### Backend — `app/domains/isp/`

* **Model** (`models.py`): two tables, "current state + history," mirroring
  `app.domains.monitoring`'s own established split.
  * `IspLink` — one row per WAN uplink. Real columns for `provider_name`,
    `link_type` (fiber/DSL/cable/4G/5G/satellite/leased-line/other),
    `connection_mode` (static/DHCP/PPPoE — drives which live RouterOS
    check `ping_link` uses), `role` (primary/backup),
    `is_active_uplink` (which link is *actually* carrying traffic right
    now — partial-unique-indexed so at most one per router),
    `auto_failback`, `is_enabled`, `priority`, `interface`,
    `gateway_ip_address`, `dns_primary/secondary`,
    `download_bandwidth_mbps`/`upload_bandwidth_mbps` (the *provisioned
    plan*, admin-entered, never measured), `load_balance_weight`,
    `health_status`/`health_status_source` (automated vs. manual
    override), `latency_ms`, `packet_loss_percentage`,
    `consecutive_unhealthy_count`, and — the field the dashboard widget
    actually reads — `current_download_mbps`/`current_upload_mbps` (the
    most recent *measured* traffic rate, from real router interface
    byte-counter deltas, distinct from the provisioned-plan columns).
  * `IspHealthCheck` — one append-only row per real health-check
    execution: `checked_at`, `status`, `source`, `latency_ms`,
    `packet_loss_percentage`, `error_message`, `download_mbps`,
    `upload_mbps`. This is what every history chart in the product reads
    from — never a second, parallel table.
* **Sampling interval** (`constants.py`): `ISP_HEALTH_CHECK_SWEEP_INTERVAL_SECONDS
  = 30.0` — dropped from 600s → 60s → 30s across real, documented
  incidents ("a customer directly reported the up/down notification
  email itself arriving too slowly to feel real"). The sweep
  (`service.run_health_check_sweep`, wired via Celery Beat in
  `tasks.py`) is **sequential, one real RouterOS connection at a time**,
  not fanned out — the module's own comment already flags this as a real
  scale risk once link count passes "1000+," explicitly out of scope to
  fix now. Today's real platform-wide link count is "a handful (two
  organizations, one router each)" per that same comment.
* **Traffic sampling** (`service.py:858` `sample_link_traffic`): reads
  real `rx-byte`/`tx-byte` interface counters, connection-mode-independent
  (works identically for static/DHCP/PPPoE — a PPPoE link's own virtual
  `pppoe-client` interface carries its own real counters). Returns `None`
  (never a fabricated `0`) when nothing real can be attributed — no
  interface configured, no router credentials, or a counter that went
  backwards (interface reset/reboot). This is exactly what backs the
  already-verified-accurate dashboard widget.
* **Manual override** (`service.py:1055` `set_manual_health_status`):
  restricted to healthy/unhealthy (binary, no fake nuance), writes a
  `source=manual` `IspHealthCheck` row, and is explicitly reclaimed back
  to `automated` by the very next real ping. Never opens a device
  connection.
* **Failover/failback** (`service.py:1163`/`1220`
  `trigger_failover`/`trigger_failback`, plus the automated
  `_maybe_transition_uplink` at `service.py:1123`, called after every
  recorded health check): **database-only.** `trigger_failover` picks the
  best enabled, non-unhealthy backup and flips `is_active_uplink` — no
  `device_adapters` call anywhere in either method. See "Gap 4" below;
  this is the single most important thing for the network-engineer track
  to verify empirically.
* **Speed test** (`service.py:629` `run_speed_test`): a real, on-demand
  RouterOS `/tool/fetch` download (Cloudflare's `/__down?bytes=N`
  endpoint, 10MB, chosen and tuned against a real test org's real
  MikroTik hEX lite over its real Airtel WAN link — `constants.py:177-199`
  documents the actual live numbers: 6s, ~13.3 Mbps). Real per-link Redis
  cooldown (60s) so an admin can't hammer a customer's own metered
  bandwidth. `upload_mbps` is honestly always `null` — "no genuine method
  to measure real upload throughput against the public internet exists
  for this hardware class."
* **History/analytics endpoints** (`router.py`,
  `schemas.py:180-212`): `GET /isp/links/{id}/health-checks` (paginated
  raw rows + computed availability %) and `GET
  /isp/links/{id}/health-checks/summary` (SQL-side time-bucketed —
  hourly for 24h/7d, daily for 30d — uptime **and** bandwidth
  aggregates: `avg_download_mbps`/`avg_upload_mbps`/`max_download_mbps`,
  NULL-safe). Both per-link only — no cross-link or cross-location
  aggregation endpoint exists yet (relevant to Gap 3 and the deferred
  "ISP Analytics" page below).
* **Device adapters** (`device_adapters.py`): real `librouteros`-based
  RouterOS client code — `/tool/ping` via the raw command form (not a
  menu `Path`), DHCP gateway resolution via `/ip/route` (re-resolved live
  every check, never a stale manually-typed value), PPPoE health via the
  client interface's own running/disabled state. The module's own
  docstring is explicit: **"There is no live MikroTik device anywhere in
  this sandbox"** for general development — some paths (speed test) have
  a documented live confirmation, others (PPPoE interface counters after
  a real reconnect, DHCP lease renewal mid-flight) do not. See the
  network-engineer track.
* **Retention**: no cleanup/archival task exists for `isp_health_checks`
  anywhere in this domain or elsewhere. At 30s cadence that's 2,880
  rows/link/day (~1M/link/year). Not urgent at today's real scale (see
  above) but cheap to fix now before it needs a migration under time
  pressure later.

### Backend — Alerting already exists (`app/domains/monitoring`)

This is the biggest surprise of the audit. A real Alert Engine +
Notification Engine + Incident Engine + SLA Monitoring module (labeled
"BE-011 Part 2" in its own constants file) is fully built:

* `AlertTriggerType.HEALTH_STATUS_CHANGE` rules can watch
  `ALERT_TARGET_ROUTER` (any router's `health_status`),
  **`ALERT_TARGET_ISP_LINK`** (any `IspLink.health_status`, kept fresh by
  the ISP sweep — `monitoring/constants.py:253-272`), or
  `ALERT_TARGET_MONITORED_HARDWARE`.
* `AlertService._evaluate_health_status_rule` has a real, working branch
  for `ALERT_TARGET_ISP_LINK`, composed read-only against
  `IspRepository`/`repository.list_isp_links` (`monitoring/service.py:1443`).
* Real multi-channel dispatch: Email/SMS wrap the existing OTP provider
  protocols; Slack/Teams/Discord/generic Webhook are real
  `httpx.AsyncClient` POSTs; WhatsApp is an honest logging-only
  placeholder (no paid Business API account in this sandbox).
* The alert-rule evaluation sweep is on a 30s cadence, deliberately
  matched to the ISP sweep's own 30s cadence (`monitoring/constants.py:358-390`
  documents this being lowered twice, in step with the ISP domain's own
  interval, after a customer complained a 15-minute alert delay "didn't
  feel real-time"). End to end, a real ISP outage is alertable within
  about one health-check cycle.
* **What's missing is entirely on the frontend** — see Gap 2.
* **What's untested**, as far as this audit found: no evidence
  (integration test, changelog note, or code comment) that the
  `ALERT_TARGET_ISP_LINK` branch has ever actually fired end-to-end
  (rule created → real link goes unhealthy → alert triggered →
  notification dispatched). It reads as correct, but "reads as correct"
  and "has been run once" are different claims. Verify before surfacing
  it, per the BE track below.

### Backend — routing rules (`app/domains/isp_routing`) — separate domain, already-scoped-out

A second, separate domain (not `app.domains.isp`) backs VLAN/MAC/IP/
CIDR/interface/policy traffic-pinning rules ("Routing Rules" in both
`IspManagement.tsx` and the customer "Internet Connection" view). Its own
`docs/isp_routing/FLOW.md` is explicit: **"No live device push in this
pass"** — a rule saved today is a pure database row; nothing pushes the
real `/ip firewall mangle` + `/routing table` + `/ip route` config it
implies onto the actual router. This is explicitly, deliberately deferred
pending a not-yet-built "Network Configuration Management" domain
(roadmap item #11, which is meant to own versioning/backup/rollback
across DHCP/VLAN/Port Forwarding/QoS/ISP Routing/Hotspot behind one
mechanism). **This is not part of this initiative.** Flagged here only so
the team doesn't rediscover it mid-sprint and panic — it's a known,
already-documented gap with its own, larger, separately-owned fix.

### Frontend

* **Master Console** `/network/isp` → `IspManagement.tsx` (819 lines):
  real CRUD for uplinks + routing rules, per-router, manual
  failover/failback triggers, on-demand health check. Full-featured,
  nothing to add here for this rollout.
* **Customer Dashboard "Internet Connection"** (`isp-details` route →
  `CustomerFeaturePage` → `IspDetailsView` in
  `src/components/features/OperationsFeatures.tsx:1645-2254`): the real,
  rich surface. Per-link live traffic ("Live: X↓/Y↑ Mbps," visually
  distinct from the provisioned-plan figure), on-demand real speed test,
  per-link health-check history dialog with an Uptime/Bandwidth toggle
  (`IspHealthHistoryDialog`, `OperationsFeatures.tsx:1300-1529`, reading
  the bucketed summary endpoint), manual up/down override, status-timeline
  sparkline, 20s auto-refresh paused via the Page Visibility API while
  the tab is hidden, failover/failback triggers, full routing-rules CRUD
  (merged in from a former separate page). This view is already
  everything the brief imagined building.
* **Dashboard home widget** (`BandwidthUtilizationCard`,
  `src/routes/c.index.tsx:618-803`, driven by `useBandwidthSeries` at
  `c.index.tsx:258-320`): accurate for what it shows (already
  independently verified), but **single-link only** —
  `useBandwidthSeries` resolves `links.find(l => l.isActiveUplink) ??
  links[0]`, then only ever polls that one link's checks. A location
  with a primary + backup configured shows exactly one of them on the
  one screen an admin actually opens daily, with no indication a second
  link exists at all. This is Gap 3.
* **`/network/wan`** (`ComingSoonPanel`, "WAN Configuration — PPPoE, DHCP
  and static WAN configuration with health probes and MTU tuning"): a
  stub. But everything it promises except MTU/MSS tuning already shipped
  — under a different name — in the ISP Link create/edit dialog's
  `connectionMode` field (static/DHCP/PPPoE) plus gateway/DNS. This is an
  orphaned duplicate stub, not a real gap. MTU/MSS clamping genuinely
  doesn't exist anywhere (no `mtu` column on `IspLink`, no script-generator
  support) — real for PPPoE-heavy Indian ISPs, but not common enough to
  justify new scope here; noted as a future candidate, not this slice.
* **`/analytics/isp`** (`ComingSoonPanel`, "ISP Analytics — jitter, SLA,
  cost per Mbps per ISP and location"): also a stub. The backend's
  bucketed summary is per-link only — a real cross-link/cross-location
  page needs new backend aggregation work, not just frontend wiring.
  Genuinely valuable, genuinely not free — flagged as a good follow-on
  once Gap 3's per-location aggregation work (below) exists to build on,
  not part of this bounded slice.
* **Reports** (`UserReports.tsx`) "Bandwidth & Cost Report": real (not
  mocked) for live accounts, but sourced from **guest session byte
  totals** (`GET /guest-sessions`, summing `bytes_uploaded`/
  `bytes_downloaded` — `realDataConsumption`, `UserReports.tsx:348-371`)
  — a genuinely different concept (how much data guests actually
  consumed, for cost estimation) from ISP link capacity/throughput
  monitoring. Its `peakMbps` column is honestly always `null`, with a
  comment explaining why: "the backend doesn't track per-day peak
  throughput anywhere in guest-sessions." The ISP domain already computes
  exactly this (`IspHealthCheckBucketResponse.max_download_mbps`) — it's
  just never been connected to this report. Small, real, cheap win (Gap
  3's BE work doubles as the fix — see below).
* **Router provisioning** (`src/routes/master.routers.tsx`,
  `src/components/routers/RouterDetailTabs.tsx`'s
  `buildRouterSetupScriptChunks`): genuinely provisions real multi-WAN
  failover/load-balancing on the device — PCC mangle rules,
  `check-gateway=ping` distance-ordered routes, PPPoE client creation —
  from a `wans: WanEntry[]` array (`iface`/`mode`/`ip`/`cidr`/`gateway`/
  `pppoeUsername`/`pppoePassword`/`weight`) collected directly in the
  provisioning wizard. **Confirmed: nothing in `master.routers.tsx` ever
  calls `ispService`/`createLink`.** A router provisioned today gets real,
  working dual-WAN failover on-device with zero corresponding rows in
  `isp_links`. This is Gap 1 — see below.
* **Alert Rules UI** (`src/components/monitoring/AlertRulesPanel.tsx:395-433`):
  the "Watches" dropdown for a `health_status_change` rule offers
  `ALERT_TARGET_ROUTER` and `HEALTH_COMPONENT_OPTIONS` only. It does not
  list `ALERT_TARGET_ISP_LINK` (or `ALERT_TARGET_MONITORED_HARDWARE`),
  despite both being fully implemented on the backend. This is Gap 2.

---

## Prioritized gap list

| # | Gap | Impact | Effort | In this slice? |
|---|---|---|---|---|
| 1 | Router provisioning never creates `IspLink` rows — monitoring is off by default on every new router until someone manually re-enters it | High — silently defeats the whole feature at the exact moment it should turn on | Low-Medium | **Yes** |
| 2 | Alert Rules UI can't target ISP links, despite full backend support | High — "tell me when my internet goes down" is the single most obvious ask for this product's real users | Low | **Yes** |
| 3 | Dashboard home widget shows only one ISP link even when 2+ exist | Medium — the one screen admins actually check daily hides a real backup/degraded link | Low | **Yes** |
| 4 | Failover tracking is DB-only; never verified against real device behavior | Medium-High (trust/safety) — a silent divergence between "dashboard says backup is active" and "traffic is still on the dying primary" is a real incident, not a cosmetic bug | N/A (verification, not a build) | **Yes** — network-engineer track |
| 5 | No retention on `isp_health_checks` | Low today, grows into a real migration-under-pressure problem | Very low | Yes (cheap, bundle into BE track) |
| 6 | `peakMbps` always null in Bandwidth & Cost Report | Low-Medium, cheap real win | Low | Yes (rides along with Gap 3's BE work) |
| 7 | No bandwidth/Mbps threshold alert type (only CPU/RAM/uptime/clients) | Real, but the dashboard widget's own client-side "90%+ in N of last M readings" heuristic already covers the actual founder ask reasonably well | Medium | **No** — defer, don't build a second alerting mechanism for a problem the widget already handles honestly |
| 8 | `/analytics/isp` cross-link analytics page | Real future value | Medium-High (needs new BE aggregation) | **No** — good follow-on once Gap 3's per-location work exists |
| 9 | `/network/wan` orphaned stub | Cosmetic | Trivial | Yes (5-minute FE cleanup, bundle into FE track) |
| 10 | `isp_routing` rules never pushed to a real device | Real, but explicitly owned by a separate, larger, already-documented future roadmap item (#11) | N/A | **No** — not this initiative |
| 11 | MTU/MSS tuning | Real for some PPPoE ISPs, not common enough to justify scope now | Medium | **No** — future candidate only |

---

## First-slice scope: three tracks

### BE track

1. **Idempotent ISP-link registration for provisioning** (serves FE
   track #1). Today `IspService.create_link` only guards against a
   second `PRIMARY` link per router (`IspPrimaryLinkAlreadyExistsError`,
   `service.py:309-314`) — nothing prevents a duplicate `BACKUP` link on
   re-run (e.g., an admin regenerates the setup script for an
   already-provisioned router). Add a real guard — dedupe by
   `(router_id, interface)` — so calling create repeatedly from the
   provisioning flow is safe. Either extend `create_link` itself to
   upsert-by-interface, or add a small
   `get_or_create_link_for_interface` service method the FE calls
   instead of raw `create_link`. No new schema needed — `IspLinkCreateRequest`
   already carries every field the provisioning wizard collects
   (`router_id`, `provider_name`, `link_type`, `connection_mode`, `role`,
   `priority`, `interface`, `gateway_ip_address`, `dns_primary/secondary`,
   bandwidth, `auto_failback`).
2. **Retention sweep for `isp_health_checks`.** A new Celery Beat task
   (mirror the shape of `run_isp_health_check_sweep` in the same
   `tasks.py`), deleting rows older than a fixed window — 90 days is
   reasonable given the sweep's own 30s cadence and today's real scale.
   A plain module constant (`ISP_HEALTH_CHECK_RETENTION_DAYS`), not a
   `Settings` field, matching this domain's own established "plain
   constant until a real per-org tunability need shows up" convention.
3. **Per-location daily bandwidth aggregation endpoint** — new, small:
   `GET /isp/locations/{location_id}/bandwidth-daily-summary?start=&end=`,
   returning one row per day with avg/max download+upload Mbps **across
   every enabled link at that location** (not per-link — a genuine new
   aggregation, SQL-side, the same bucketing discipline
   `get_health_check_summary` already establishes). This directly fixes
   the Bandwidth & Cost Report's honest `peakMbps: null` gap (FE track
   wires it in) and is deliberately shaped to also be the foundation for
   the deferred `/analytics/isp` page later, without building that whole
   page now.
4. **Verify `ALERT_TARGET_ISP_LINK` end-to-end** before FE surfaces it
   (Gap 2). Add an integration test: create an `AlertRule` with
   `target_component=ALERT_TARGET_ISP_LINK`, drive a real `IspLink` to
   `unhealthy` via `record_health_check_result`, run
   `evaluate_alert_rules`, assert an `Alert` row is created and
   `dispatch_notification` is called. If this surfaces a real bug, fix it
   here — this must be genuinely solid before an admin starts relying on
   it to know their internet is down.

### FE track

1. **Auto-register ISP links during router provisioning.** After
   `buildRouterSetupScriptChunks` succeeds in `master.routers.tsx`, call
   the new BE endpoint (or existing `create_link`, guarded by BE track
   #1) once per entry in `activeWans`: `role = idx === 0 ? "primary" :
   "backup"`, `connection_mode = wan.mode`, `interface = wan.iface`,
   `gateway_ip_address = wan.gateway` (static only), `provider_name`
   defaulting to a placeholder (`"WAN 1"`, `"WAN 2"`, ...) since the
   wizard doesn't collect a real ISP name today and that's not required
   to turn monitoring on — an admin renames it later in "Internet
   Connection" the same way they already edit any other link field. Show
   a real confirmation ("2 ISP links registered for monitoring") so this
   isn't silent. Skip this in `basicConfigOnly` mode (technician-manual
   WAN setup) where gateway/IP fields are genuinely unknown to the
   platform — creating a link with a real interface name but no gateway
   is fine (DHCP/PPPoE don't need one anyway); creating one with neither
   an interface nor any way to health-check it is not.
2. **Add ISP links (and monitored hardware) to the Alert Rules "Watches"
   dropdown** (`AlertRulesPanel.tsx:395-433`). Mirror whatever subject-
   picker pattern `ALERT_TARGET_ROUTER` already uses for scoping "any
   router" vs. a specific one, if any exists — otherwise this can start
   as "any ISP link in scope goes to `<status>`," matching the backend's
   own current all-links-in-scope evaluation shape exactly (no new BE
   work required beyond track BE#4's verification). Ship after BE#4
   confirms the path actually fires.
3. **Multi-link-aware dashboard widget.** `BandwidthUtilizationCard`
   (`c.index.tsx:618`) and its `useBandwidthSeries` hook currently pick
   one link and never mention the rest. When a location has more than
   one enabled link, add a compact per-link status row above the
   existing chart (provider name + health badge + live Mbps, reusing the
   `HealthBadge` component `IspDetailsView` already has) so a backup
   link's real state is visible without a click-through. Keep the
   existing chart as the detail view for whichever link is currently
   active — this is additive, not a rebuild. No new backend endpoint
   needed (`ispService.listLinks` already returns every link).
4. **Wire `peakMbps` in the Bandwidth & Cost Report** to the new BE
   per-location daily aggregation endpoint (BE track #3), replacing the
   `null` with a real value and dropping the now-stale "backend doesn't
   track this" comment.
5. **Failover button honesty.** Add a tooltip/microcopy to "Trigger
   failover"/"Trigger failback" (both `IspManagement.tsx` and
   `IspDetailsView`) clarifying that this updates the platform's own
   tracking and does not itself push new routing config to the router —
   real on-device failover is handled automatically by the router's own
   gateway-check routes. Cheap, and prevents a real misunderstanding
   ("I clicked this, why is the primary still carrying traffic") that
   the current button copy invites. Ship in step with (not blocking)
   the network-engineer track's findings below — if that track finds a
   real divergence risk, strengthen this copy accordingly.
6. **Cleanup: `/network/wan`.** Either redirect it to the real ISP
   management view or remove the nav entry — its promised functionality
   (PPPoE/DHCP/static config) already shipped under "Internet Connection"
   / "Network → ISP." Trivial, but leaving a "Coming Soon" stub next to
   the real, working feature it duplicates actively confuses whoever
   finds it.

### Network-engineer track

1. **The most important item: verify failover convergence on real
   hardware.** Force a real primary-link outage on a real dual-WAN router
   (two live ISP connections) and observe, with a stopwatch: (a) how long
   RouterOS's own `check-gateway=ping` routes take to actually move
   traffic to the backup WAN; (b) how long this domain's own health-check
   sweep + `_maybe_transition_uplink` (3 consecutive failures at 30s
   cadence, ~90s) takes to flip `is_active_uplink` in the dashboard; (c)
   whether the two ever disagree about which link is "active," even
   transiently; (d) what real guest traffic actually does if an admin
   manually clicks "Trigger failover" in the dashboard *before* RouterOS
   has independently failed over on its own — does anything change on
   the wire, or does the dashboard just relabel itself while traffic
   keeps flowing through the still-struggling primary. This directly
   informs whether FE track #5's copy fix is sufficient or whether this
   needs a stronger warning (or a real fix, later, to actually push a
   route-priority change when an admin forces failover).
2. **PPPoE interface counters across a real reconnect.** Confirm that a
   PPPoE WAN's virtual `pppoe-client` interface's `rx-byte`/`tx-byte`
   counters behave as `sample_link_traffic`'s "counter went backwards →
   report no rate this tick, never a fabricated negative" logic expects,
   specifically across a real ISP-side PPPoE re-authentication (common on
   Indian fiber ISPs) — not just a clean reboot, which is the only case
   this logic's own comments were written against.
3. **DHCP gateway re-resolution on a real lease renewal.** Confirm
   `get_active_default_gateway` (re-resolved live every check from
   `/ip/route`) correctly follows a genuine ISP-initiated DHCP gateway
   change, not just a static test-lab gateway that never actually
   changes.
4. **Sequential-sweep timing, informational only.** Get one real number:
   how long does one full connect+ping+traffic-sample cycle actually take
   against real hardware (the hEX lite class already used for the speed
   test confirmation)? This calibrates how much headroom exists before
   the sweep's own documented "sequential, not fanned out" scale risk
   (`constants.py:235-257`) becomes real. Not a blocker for this slice
   (today's real link count is a handful) — just get the number on file
   so whoever revisits it later isn't guessing.

---

## Explicitly deferred (real, but not this slice — don't build)

* **Bandwidth/Mbps threshold alerting** (a real `ThresholdMetric` option
  for "alert when download drops below X Mbps"). The dashboard widget's
  own client-side congestion heuristic ("hit 90%+ of plan in N of the
  last M readings") already answers the actual founder question ("is my
  plan too small") reasonably honestly. Building a second, persisted,
  alertable version of the same idea is real work for a marginal gain
  over what already exists — revisit if real customers ask for it
  specifically, not preemptively.
* **`/analytics/isp` cross-link/cross-location analytics page** (jitter,
  SLA, cost-per-Mbps). Genuinely valuable, genuinely not cheap — needs
  real new backend aggregation beyond what BE track #3 builds. This
  slice's per-location daily summary endpoint is deliberately shaped to
  make that page cheaper to build later; building the page itself now
  would blow the "bounded" budget for this rollout.
* **`isp_routing` rules realized onto real devices.** Already a
  documented, separately-owned future roadmap item (#11, "Network
  Configuration Management"). Not this initiative's problem to solve.
* **MTU/MSS clamping.** Real for some PPPoE setups, not common enough
  today to justify new schema + script-generator + UI work in this
  rollout.
* **Fixing the sequential (non-fanned-out) health-check sweep.** Already
  flagged, twice, in the backend's own code comments as a real future
  problem at 1000+ links. Today's real scale doesn't need it yet — the
  network-engineer track's timing measurement (item 4 above) is there so
  the *next* team to revisit this has a real number instead of a guess,
  not so this team builds the fix now.

---

## Rollout order

1. BE track #1 (idempotent registration) and #4 (verify alert path) can
   start immediately and in parallel — neither depends on anything else.
2. FE track #1 (provisioning auto-registration) depends on BE #1.
3. FE track #2 (Alert Rules UI) depends on BE #4 passing.
4. BE track #2 (retention) and #3 (aggregation endpoint) can run in
   parallel with everything above.
5. FE track #3 (multi-link widget), #4 (peakMbps wiring, depends on BE
   #3), #5 (button copy), #6 (stub cleanup) have no cross-track
   dependencies and can ship whenever convenient.
6. Network-engineer track runs independently, on real hardware, as soon
   as access is available — its findings feed back into FE #5's copy
   (and, if a real divergence is found, into a follow-up spec for
   actually pushing a route-priority change on manual failover, which is
   explicitly out of scope for *this* slice).
