# Master Console Design Audit (2026-08-19)

Scope: a pure visual/UI design audit of the Wyfy Guest Master Console
(`/master/*`, Wyfy's internal staff tool for platform ops/support/sales/
billing/network-admin) — typography, spacing, color, layout, table density,
status/severity color encoding, and consistency across the 15 nav
destinations. No new features, no backend changes. Explicitly out of scope
and untouched: the concurrent "Team & Access" build
(`master.operators.tsx` and related new files) and anything under the
customer-facing dashboard or marketing site.

This surface went through real v3 accent work earlier today: `MStat`'s
rotating "Border Beam" ring, `MTable`'s shimmer-skeleton loading state,
`MEmptyState`'s sparkle-field first-run treatment, and `MDrawer`/`MDialog`'s
mount transitions (all in `src/components/master/MasterKit.tsx`). This
audit's Phase 1 question was whether that pass — and the underlying design
system it sits on — actually landed *evenly* across all 15 destinations, or
only on the ones someone happened to look at.

## Method

Full read of `MasterKit.tsx` (the shared primitive library), `MasterShell.tsx`
(nav/chrome), and every `master.*.tsx` route (~7,200 lines total), cross-
referenced against every `<MTag>`/`<MTable>` call site's actual `label`/
`tone` values and the TypeScript union types feeding them, plus the
sibling badge/table components some routes reuse from the shared
`components/{audit,billing,monitoring}` tree.

## Findings

### 1. Severity color encoding — a real, evidenced gap on the console's own home screen (fixed)

`MTag`'s `TAG_STYLES` map is the single shared status/severity color table
almost every route relies on. It had no entry for `"critical"` or
`"warning"` — the two most alarming values in
`Reminder["severity"]: "info" | "warning" | "critical"` (`types/billing.ts`).
`MTag`'s own fallback (`TAG_STYLES[key] ?? "bg-muted text-muted-foreground"`)
means any tag rendered with those tones silently fell through to plain
gray — visually indistinguishable from a routine/neutral one.

This isn't theoretical: **Platform Overview** (`master.index.tsx`, the
first screen every operator sees), its "Billing Reminders" widget, renders
`<MTag label={r.severity} />` directly against this same field. A reminder
about a customer whose subscription is about to be suspended (`"critical"`)
rendered identically to a routine one. The sibling `RemindersPanel`
component (`components/billing/RemindersPanel.tsx`), reading the exact same
field on the Billing page, already colors `critical` rose and `warning`
amber — so the same data point was correctly color-coded on one screen and
invisible on another.

**Shipped:** added `critical` (rose) and `warning`/`info` (amber/neutral)
entries to `TAG_STYLES` in `MasterKit.tsx`, matching `RemindersPanel`'s
existing tones. One-file fix — no route call sites needed to change, since
`MTag` already falls back to using `label` as the color key when no
explicit `tone` is passed.

### 2. Ticket priority: "Urgent" and "High" render as the same color (fixed)

Support Tickets' priority column explicitly collapsed two distinct
severities into one tone:

```tsx
tone={t.priority === "urgent" || t.priority === "high" ? "high" : "normal"}
```

Both `"urgent"` and `"high"` priority tickets rendered amber (`high`'s
tone), even though `TAG_STYLES` already has a distinct, more alarming
`urgent` tone (rose) — used correctly elsewhere in the same console (NAS
status, channel-partner welcome-email failures). An operator scanning the
Support Tickets queue for the truly urgent items had no color signal to
separate them from merely-high ones.

**Shipped:** `tone={t.priority === "urgent" ? "urgent" : t.priority === "high" ? "high" : "normal"}`
in `master.tickets.tsx` — Urgent now reads rose, High reads amber, same
distinction the design system already had sitting unused.

### 3. The v3 loading-skeleton accent shipped on zero of the 8 routes that could use it (fixed)

`MTable`'s new `loading` prop (shimmer-sweep skeleton rows, `m-table-skel-bar`
+ the existing `shimmer` utility) has a doc comment explicitly framing it as
replacing "every route['s]... hand-rolling its own spinner block," and
names `master.channel-partners.tsx`'s pre-v3 loading branch as the example
of what it replaces "going forward."

In practice, **every single `<MTable>` call site across the whole console
(Customers, Channel Partners, Demo Requests, NAS/RADIUS, All Locations,
Quotations, Support Tickets, Router Fleet — 8 of 8) still gated the entire
table behind the old pattern**: a full-width centered `<Loader2
className="animate-spin" />` + "Loading X…" block, swapped out for the
`<MTable>` only once data arrived. The shimmer-skeleton feature shipped in
`MasterKit.tsx` was never actually wired into any of the routes it was
built for — the exact "v3 accents landed on some pages, not others" failure
mode this audit was asked to check for, just inverted: it landed on *zero*
list pages and only ever fired on `MStat`'s beam/`MEmptyState`'s sparkle.

**Shipped:** wired `loading={loading}` into all 8 `<MTable>` call sites and
removed the now-redundant spinner-block branch in `master.customers.tsx`,
`master.channel-partners.tsx`, `master.demo-requests.tsx`, `master.nas.tsx`,
`master.locations.tsx`, `master.quotations.tsx`, `master.tickets.tsx`, and
`master.routers.tsx` (Router Fleet — one of the two data-heaviest screens
named in this audit's brief). Every list page's loading state is now the
same shimmer-skeleton table instead of a spinner that replaces the whole
page furniture (filters, search, header) with a blank centered box.

### 4. Three of the densest screens run on a visually different design system (documented, not fixed — see rationale)

`master.audit.tsx` (Audit Logs), `master.billing.tsx` (Billing's actual
data tables — `SubscriptionTable`, `PaymentTable`, `InvoiceManagement`,
etc.), and `master.health.tsx` (System Health) don't use `MTable`/`MTag`/
`MEmptyState` at all. They reuse real, already-built components from
`src/components/{audit,billing,monitoring}` that are *also* the live
components behind the customer-facing `/_authenticated/audit`,
`/_authenticated/billing`, and `/_authenticated/monitoring` pages — a
deliberate reuse decision each route's own module comment documents
("identical precedent... rather than rebuild it").

The visible result, exactly matching this audit's brief ("is critical
always the same red across every screen?"):

- **Hue mismatch.** `MonitoringBadges.tsx` (backing System Health) colors
  `critical`/`unhealthy`/`offline` states with Tailwind **`red`**
  (`bg-red-500/15 text-red-500`), while `MTag` and `BillingBadges.tsx` both
  use **`rose`** for the same semantic danger state. `red` and `rose` are
  genuinely different hues in Tailwind's palette — the same word
  ("offline," "critical") is a visibly different shade of red depending on
  which of these three screens shows it.
- **Container-style mismatch.** `MTag` renders a solid soft-filled pill,
  no border. `BillingBadges`/`MonitoringBadges` render an outlined
  `shadcn Badge` (visible border, lighter fill) — same hue family in
  Billing's case, different treatment.
- **Table header typography mismatch.** `MTable`'s shared header row is
  `text-[11px] uppercase tracking-wide font-semibold` — a deliberate
  small-caps enterprise-console signature that's consistent across the 8
  `MTable` routes. Audit/Billing/Health's plain `shadcn <TableHead>` is
  sentence-case with no tracking, so the table header register visibly
  changes switching from, say, Router Fleet to Audit Logs.
- **Loading/empty-state mismatch.** These three screens use the generic
  `LoadingSkeleton`/`Skeleton` (static pulse) and `EmptyState` (muted-gray
  icon, dashed border) instead of `MTable`'s shimmer sweep or
  `MEmptyState`'s branded primary-tinted icon + sparkle field — so the v3
  loading/empty polish from Finding 3 and the empty-state work never
  reaches Audit Logs, Billing's tables, or Health either.

**Why this is flagged, not fixed here:** every one of these child
components (`AuditTable`, `SubscriptionTable`, `HealthDashboard`, their
badge helpers) is shared, load-bearing code for the *customer* dashboard,
not Master-exclusive. Restyling them to match `MasterKit` would mean
editing customer-facing UI — outside this audit's Master-Console-only
mandate, and real risk of colliding with other concurrent work on that
surface. The safer, correctly-scoped fix is a follow-up with its own
review: either (a) give `MonitoringBadges.tsx` a `rose` variant so its hue
matches `MTag`/`BillingBadges` without touching its consumers'
call sites, done as a change explicitly reviewed against customer-dashboard
impact, or (b) accept the dual-system split as a permanent, documented
seam (the reuse itself is sound engineering — real components, real data,
no duplication) and only harmonize the loading/empty-state treatment,
which is lower-risk than a color-token change to a widely shared badge
file. Recommend the PM roadmap track this as its own scoped item rather
than folding it into this pass.

### Not pursued (checked, found sound)

- `STATUS_TONE` maps in `master.channel-partners.tsx`, `master.demo-requests.tsx`,
  and `master.quotations.tsx` were checked exhaustively against their status
  enums — all map to valid, correctly-colored `TAG_STYLES` keys.
- Router Fleet's own `RouterStatus` union has two values (`provisioning`,
  `decommissioned`) that fall through to `MTag`'s neutral-gray default —
  a minor gap, but a defensible one (both are legitimately
  "no strong signal needed" states, not danger states), so left alone.
- `MasterShell.tsx` nav, grouping, and RBAC-gated visibility were read in
  full — no visual inconsistency found; it's the one part of this console
  every route shares unconditionally.
- Table density (`MTd`/`MTh` padding) is consistent across all 8 `MTable`
  routes already — no changes needed there.

## What shipped

All changes are scoped to Master-Console-only files (`MasterKit.tsx` +
7 `master.*.tsx` routes), verified with `tsc --noEmit` (zero new errors —
the 17 pre-existing repo-wide errors are all in unrelated files this audit
never touched) and a full `vite build` (succeeds).

1. `src/components/master/MasterKit.tsx` — added `critical`/`warning`/`info`
   tones to `TAG_STYLES`.
2. `src/routes/master.tickets.tsx` — distinct `urgent` vs `high` priority
   tone.
3. `src/routes/master.customers.tsx`, `master.channel-partners.tsx`,
   `master.demo-requests.tsx`, `master.nas.tsx`, `master.locations.tsx`,
   `master.quotations.tsx`, `master.tickets.tsx`, `master.routers.tsx` —
   wired `MTable`'s `loading` shimmer-skeleton prop, removed the redundant
   pre-v3 spinner-block branch on all 8 list pages.
