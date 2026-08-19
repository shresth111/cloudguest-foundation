# Design audit: customer/org-admin dashboard (`/`, `/c/*`)

Scope: pure visual/UX design — typography, spacing, color, layout, states,
motion, density, cross-page consistency. No feature work; the Customer
Dashboard PM roadmap (`docs/pm-customer-dashboard-roadmap.md`) owns the
functional lane and isn't touched here.

Method: read the real rendered app (Chrome, demo login `admin@example.com` /
`test`, which the app itself ships for exactly this kind of walkthrough) plus
the component source in `src/components/customer/`, `src/routes/*.tsx`
(customer-facing routes), and `src/components/features/*`. Screens covered:
location picker (`/switch-location`), Dashboard, Reports, Portal branding,
Alerts, Users (data table + detail drawer), and the login form.

Baseline acknowledged: today's v3 design pass (#74–#77, #88) already landed a
real token/motion upgrade — consistent indigo primary, Aceternity/Magic UI
accents, flattened glass/gradient remnants on the captive portal. This audit
looked for what's still rough *on top of* that baseline, not for v2-era
issues that are already fixed.

## Findings

### 1. Report-category tab bar wrapped into 3 ragged lines (fixed)
`src/components/features/UserReports.tsx` — the Reports page's category
switcher (`Guest Activity Report` / `Voucher Redemption Report` / …) already
opts into horizontal scroll on narrow viewports (`overflow-x-auto` on the
wrapping pill), but the buttons had no `whitespace-nowrap`, so their own text
wrapped instead of the row scrolling. Longer labels like "Campaign Engagement
Report" broke across 3 lines and inflated the tab bar to ~120px tall even on
a full desktop viewport with plenty of horizontal room to spare — well before
any scrolling was ever needed. **Fixed**: added `whitespace-nowrap`; `flex-1`
already keeps buttons filling available width when there's room, and its
default `min-width: auto` now correctly refuses to shrink a button below its
own (single-line) text, falling through to the scroll container that was
already there.

### 2. Floating support-chat launcher overlaps page content (fixed)
`AssistantWidget` (`src/components/features/AssistantWidget.tsx`) is a
globally-mounted `fixed bottom-6 right-6` circular button (56px + 24px
margin ≈ 80px of screen it occupies), rendered as a sibling *after* every
feature page's `<main>` in `CustomerFeaturePage.tsx`. Because it's `fixed`,
it takes no space in document flow, and the shared `<main>` had only
`p-4 sm:p-6 lg:p-8` — no reserved clearance. Concretely reproduced on
**Alerts**: the last "Recent alerts" row (timestamp text) rendered partly
behind the launcher button. Since `CustomerFeaturePage.tsx` is the one shell
every one of the ~22 feature views renders through (Dashboard, Users,
Reports, Campaigns, Portal, Vouchers, Policies, Whitelist, Devices, Teams,
Agents, Alerts, Open Hours, …), any page whose last card lands near the
viewport bottom has the same risk. **Fixed**: added `pb-24` to the shared
`<main>`, in one place, covering every feature page at once.

### 3. Login form: Tab order skips the password field (fixed)
`src/routes/login.tsx` — the "Forgot password?" link sat between the Email
and Password fields in source order (label row → link → input), so
keyboard/Tab navigation from Email address landed on "Forgot password?"
*before* ever reaching Password. Verified in the live DOM by tabbing through
the real form. **Fixed** with a `flex flex-col` + CSS `order` swap that
reorders the DOM (input before the label/link row) while keeping the visual
layout byte-for-byte identical — label+link row still renders on top,
`mb-2` replaces the old order-dependent `space-y-2` gap so spacing doesn't
shift. Tab order is now Email → Password → show/hide toggle → Forgot
password? → Sign in.

### 4. Header/hero treatment is inconsistent across feature pages
Two clearly different header patterns coexist across the ~20 feature pages:
a large gradient "hero" card with a rotating quote (Dashboard, Reports — see
`UserReports.tsx`'s own comment: *"same rotating-quote pattern as the
Dashboard hero"*) vs. a compact flat icon+title+subtitle header (Portal,
Alerts, Users). Both are well-executed individually, but landing on Reports
right after Portal or Alerts reads as two different apps: the sticky app-bar
already shows "Reports · Delhi Office" as a breadcrumb, and the hero card
immediately below repeats "Reports" as a large `<h1>`, so the page name
appears twice above the fold before any real content. This looks deliberate
per the in-code comments (not a bug), so left as an observation rather than
a fix: worth a follow-up decision on whether the hero treatment is reserved
for the two truly "glanceable" pages (Dashboard, Reports) or standardized
one way across all of them.

### 5. Users table: long fade-in-on-load makes the table look broken mid-load
`/users` — rows fade in with a staggered entrance animation on first load.
At normal load speed it reads fine, but if the table is interacted with (or
screenshotted) 1–2s into that animation, later rows sit at a washed-out
partial opacity with visible row-divider lines and no content beneath them —
i.e. a real result set that briefly looks like a broken/empty table. Given
this repo has fresh, real "loading/empty" states elsewhere (Reports' "No
report run yet" panel is a good example of a properly designed empty state),
recommend either shortening/removing the staggered per-row delay or gating
first-paint until the stagger completes, so the table never has a window
where it visually resembles a data/render bug.

### 6. Sign-in toast (`Welcome back, owner!`) is slow to leave and sits over content
On the location picker (`/switch-location`), the post-login success toast
stayed on screen well past sonner's normal auto-dismiss window in testing —
still present and covering the "Which venue are we looking after today?"
copy and part of the first location card 30–60s later, and clicks on its own
close (×) didn't dismiss it either. `/switch-location` polls live stats
("Live · updated Xs ago") and re-renders on that interval, and the page grew
visibly less responsive to input the longer it sat open (multiple in-browser
automation actions timed out waiting on the page's main thread there this
session, not reproduced on any other page). The toast getting stuck reads
like a symptom of that jank rather than a toast-config bug — `Toaster` config
in `src/components/ui/sonner.tsx` is unremarkable and `toast.success` in
`login.tsx` is a single one-shot call, not one that could be re-firing on
each poll. Flagging for a follow-up performance pass on `/switch-location`
specifically (the rotating quote + live counters + per-card animations
together are the likely source) rather than fixing blind here.

### 7. Location-picker rotating quote flashes to empty space
`/switch-location`'s hero quote line ("Guests forgive a slow menu...")
crossfades on an interval; caught mid-transition it briefly leaves just the
opening-quote glyph with a blank line beneath it rather than crossfading
smoothly into the next line. Minor, but visible on a page real owners will
land on every session.

## What shipped

Three small, isolated, low-risk fixes (all verified live in Chrome
before/after, plus `tsc --noEmit` and `bun run build`, both clean of new
errors):

1. `src/components/features/UserReports.tsx` — `whitespace-nowrap` on the
   report-category tab buttons (finding #1).
2. `src/components/customer/CustomerFeaturePage.tsx` — `pb-24` on the shared
   feature-page `<main>` so the floating support launcher never covers page
   content (finding #2).
3. `src/routes/login.tsx` — DOM/tab-order fix for the password field via a
   `flex` + `order` swap, pixel-identical visually (finding #3).

Findings #4–#7 are left as documented observations rather than fixes: #4 is
a subjective design-language call that today's v3 pass may have made on
purpose and deserves a real decision rather than a drive-by change; #5–#7
are either animation-tuning or a performance investigation better scoped as
their own follow-up than bundled into a "small, surgical" visual-fix pass.
