# Wyfy Guest console tokens (`--wy-*`)

The design contract for the customer (venue-owner) workspace. Defined in
`src/styles.css`, scoped under the `.wy-console` class, so the Master
console and the guest captive portal never see them. Dark values apply
under `.dark .wy-console` (the `.dark` class lives on `<html>`).

Code against the **names**. Values may be re-tuned; names will not change.

## Where `.wy-console` sits

- The root `SidebarProvider` wrapper of every customer page
  (`CustomerFeaturePage.tsx`, `CustomerDashboardPage.tsx`, `routes/users.tsx`).
- Portaled content that must look like the console (dropdowns, popovers,
  the mobile sidebar Sheet, the command palette) carries the class itself,
  because Radix portals mount on `<body>`, outside the page wrapper.
  If you add a Popover/Dialog/DropdownMenu inside the console, add
  `wy-console` to its `*Content` className.

Inside `.wy-console` the shadcn tokens (`--background`, `--card`,
`--border`, `--primary`, `--muted-foreground`, `--sidebar*`, ...) are
re-pointed at these, so existing `bg-card` / `text-muted-foreground`
utilities follow the console palette without component changes.

## Tokens

Use them in Tailwind as arbitrary values, e.g. `bg-[var(--wy-surface)]`,
`text-[var(--wy-text-muted)]`, `border-[var(--wy-border)]`.

### Surfaces

| Token                | Purpose                                                    | Light     | Dark      |
| -------------------- | ---------------------------------------------------------- | --------- | --------- |
| `--wy-bg`            | Page canvas behind panels                                  | `#f8f9fc` | `#0d1015` |
| `--wy-surface`       | Panels, sidebar, top bar, popovers                         | `#ffffff` | `#151921` |
| `--wy-surface-2`     | Inset / hover / table header / segmented track             | `#eef0f3` | `#1c212b` |
| `--wy-border`        | Hairlines between and around panels                        | `#e3e6eb` | `#262c37` |
| `--wy-border-strong` | Inputs, focused/selected outlines, dividers that must read | `#cdd2da` | `#353d4b` |

### Text

| Token             | Purpose                                              | Light     | Dark      |
| ----------------- | ---------------------------------------------------- | --------- | --------- |
| `--wy-text`       | Primary text, values                                 | `#12161d` | `#e7eaef` |
| `--wy-text-muted` | Labels, secondary copy                               | `#4b5362` | `#a4acba` |
| `--wy-text-faint` | Tertiary: captions, units, group headers, timestamps | `#646c7b` | `#8a93a3` |

All three pass WCAG AA (4.5:1) on `--wy-bg`, `--wy-surface` and `--wy-surface-2`
in both themes (see table below). `faint` is still body-text legal; it is just
the quietest step.

### Accent

| Token              | Purpose                                         | Light     | Dark      |
| ------------------ | ----------------------------------------------- | --------- | --------- |
| `--wy-accent`      | Active nav, primary buttons, links, focus rings | `#6c4eff` | `#b4a7ff` |
| `--wy-accent-fg`   | Text/icons on a solid `--wy-accent` fill        | `#ffffff` | `#1e1b4b` |
| `--wy-accent-soft` | Active-row / selected background tint           | `#efebff` | `#2c2560` |

The owner's original violet (2026-10-31), the same family as the Wyfy
shield mark (`#6366f1 -> #7c3aed`). The accent is a brand colour, never a
status: an "Active" badge is `StatusBadge status="ok"` or neutral, not a
solid accent fill. Accent text on `--wy-accent-soft` is 4.31:1 in light,
so use it there only for large/bold text or non-text marks (it is >= 3:1,
fine for focus bars and selected outlines).

### Chrome (sidebar rail and top bar)

The rail and the top bar keep the customer portal's indigo gradient. They
re-point the surface/text tokens locally (`.wy-console.customer-rail`,
`.wy-console .wy-topbar` in `src/styles.css`), so controls inside them
follow without per-component edits.

| What                                           | Value                                                      |
| ---------------------------------------------- | ---------------------------------------------------------- |
| Rail gradient (top to bottom)                  | `#1e1b4b` 0%, `#2a2560` 30%, `#312e81` 60%, `#4c1d95` 100% |
| Top bar gradient (left to right)               | `#1e1b4b` to `#312e81`                                     |
| Chrome `--wy-surface` (menus' triggers, pills) | `#241f5c`                                                  |
| Chrome text / muted / faint                    | `#ffffff` / `#d6d3f0` / `#b9b4e0`                          |
| Chrome accent (active row label, focus)        | `#b4a7ff`                                                  |
| Active nav row fill (`--sidebar-accent`)       | `#4c1d95`                                                  |
| Nav rows                                       | 40px tall, 15px label (the owner found 13px too small)     |

Portaled content (tooltips, flyouts, menus) mounts on `<body>`, outside
the rail: give it `wy-console` and the chrome surface, or it falls back to
the root `--primary` (an off-palette blue).

### Status

Reserved for state. Never reuse as a chart series colour. Always ship with a
label or icon (StatusDot carries an accessible label), never colour alone.
Each foreground passes AA as text on `--wy-surface`, `--wy-bg`, and on its own
`-soft` background.

| Token          | Meaning                                                     | Light     | Light `-soft` | Dark      | Dark `-soft` |
| -------------- | ----------------------------------------------------------- | --------- | ------------- | --------- | ------------ |
| `--wy-ok`      | Up, healthy, checking in                                    | `#0f7a47` | `#e3f3ea`     | `#45c98a` | `#112a1f`    |
| `--wy-warn`    | Degraded, late, needs attention                             | `#9a5b00` | `#fbf0da`     | `#f0b44a` | `#2e2411`    |
| `--wy-crit`    | Down, failing, action required                              | `#c22a3d` | `#fbe8ea`     | `#f4707f` | `#35181d`    |
| `--wy-info`    | Informational, in progress                                  | `#0b66b0` | `#e4effa`     | `#5eb0f2` | `#132638`    |
| `--wy-offline` | Not applicable / unknown / no device (neutral, NOT a fault) | `#5f6776` | `#eceef2`     | `#8f98a8` | `#1f242d`    |

### Data-viz series

Categorical, assign in fixed order (series-1 first), never cycled; a 7th
series folds into "Other". Validated with the dataviz skill's
`validate_palette.js` (adjacent pairs): light worst CVD dE 9.1, normal-vision
dE 19.6; dark worst CVD dE 8.4, normal-vision dE 19.3. In light mode
series 3/4/5 are under 3:1 against white, so charts using them must carry
direct labels, a legend, or a table view (they always should anyway).

| Token           | Hue     | Light     | Dark      |
| --------------- | ------- | --------- | --------- |
| `--wy-series-1` | blue    | `#2a78d6` | `#3987e5` |
| `--wy-series-2` | orange  | `#eb6834` | `#d95926` |
| `--wy-series-3` | aqua    | `#1baf7a` | `#199e70` |
| `--wy-series-4` | yellow  | `#eda100` | `#c98500` |
| `--wy-series-5` | magenta | `#e87ba4` | `#d55181` |
| `--wy-series-6` | violet  | `#6250d6` | `#9085e9` |

Grid lines / axes: use `--wy-border` and `--wy-text-faint`. Axis and value
text wears text tokens, never the series colour.

### Shape, depth, type

| Token            | Purpose                                                                         | Value                                                                     |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `--wy-radius`    | Panels, inputs, buttons, nav rows                                               | `8px`                                                                     |
| `--wy-radius-lg` | Dialogs, popovers, large hero panels                                            | `12px`                                                                    |
| `--wy-shadow`    | Panel elevation: a hairline + faint ambient (light); hairline only feel in dark | light `0 1px 2px rgb(16 24 40 / 0.05)`; dark `0 1px 2px rgb(0 0 0 / 0.4)` |
| `--wy-font-mono` | IPs, MACs, numbers in tables, durations                                         | `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`   |

No new web fonts: the mono stack resolves to what the OS already has.
For numbers that sit in prose or tiles, prefer `tabular-nums` on the sans
face over switching to mono.

## Type scale and density

The ramp (design review 2026-10-31, §2 issue 8). Eight sizes at most per
page; nothing under 11px except chart ticks.

| Role                         | Size / weight                                                      | Where it comes from                                |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Caption, table header, badge | 11px / 500 (header uppercase, `tracking-wider`, `--wy-text-faint`) | `DataTable`, `StatusBadge`                         |
| Label, hint, description     | 12px / 400-500                                                     | `FormField`, `Panel` description, `StatTile` label |
| Body, table cell, callout    | 13px / 400                                                         | `DataTable`, `Callout`, `PageHeader` description   |
| Panel title                  | 14px / 600                                                         | `Panel`, `FormSection`                             |
| Section                      | 16px / 600                                                         |                                                    |
| Page h1                      | 20px / 600                                                         | `PageHeader` (one per page)                        |
| Stat value                   | 24-28px / 600, `tabular-nums`                                      | `StatTile`                                         |

Mono (`--wy-font-mono`, 12px) for IPs, MACs, ports and ids, via
`DataTable`'s `mono` column option or `MONO_CELL`.

Density: nav rows 40px; top bar 56px; panel header 44px; panel padding
16px; table rows 40px (`compact`, default) or 48px (`comfortable`);
toolbar controls 36px, 40px below `sm` for touch.

## Measured contrast (WCAG 2.x ratio)

Computed, not eyeballed (`contrast.mjs`, relative luminance formula).

| Pair                     | Light                              | Dark           |
| ------------------------ | ---------------------------------- | -------------- |
| text / surface           | 18.13                              | 14.60          |
| text / surface-2         | 15.88                              | 13.38          |
| text-muted / surface     | 7.74                               | 7.70           |
| text-muted / surface-2   | 6.78                               | 7.06           |
| text-faint / bg          | 5.02                               | 6.15           |
| text-faint / surface     | 5.29                               | 5.69           |
| text-faint / surface-2   | 4.63                               | 5.21           |
| accent / surface         | 5.03                               | 8.31           |
| accent / bg              | 4.78                               | 8.99           |
| accent / accent-soft     | 4.31 (large/bold or non-text only) | 6.43           |
| accent-fg / accent       | 5.03                               | 7.55           |
| ok / ok-soft             | 4.69                               | 7.26           |
| warn / warn-soft         | 4.80                               | 8.23           |
| crit / crit-soft         | 4.83                               | 5.75           |
| info / info-soft         | 5.09                               | 6.58           |
| offline / offline-soft   | 4.90                               | 5.36           |
| worst status / surface-2 | 4.72 (ok)                          | 5.55 (offline) |

## Shared primitives

`src/components/customer/console/` (import from `@/components/customer/console`).
Each reads these tokens and nothing else, and has a JSDoc on every prop.

| Primitive                                               | Use it for                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageHeader`                                            | The one header per page: h1 (20/600), venue chip, one description line, right-aligned primary actions. Replaces the shell's scope line and every in-page hero (eyebrow, icon tile, second title, illustration). The shell hands a migrated screen its title + venue as a `PageScope` (`OWN_PAGE_HEADER_FEATURES` in `CustomerPageScope.tsx`). |
| `StatusBadge`                                           | A row's state: soft `-soft` fill, token text, optional dot. The one status pill.                                                                                                                                                                                                                                                              |
| `StatusDot`                                             | A bare state dot with an accessible label.                                                                                                                                                                                                                                                                                                    |
| `StatTile`                                              | A KPI: label, big tabular value, optional `hint`, delta, sparkline.                                                                                                                                                                                                                                                                           |
| `Panel` / `PANEL_SURFACE`                               | The card. `flush` for edge-to-edge tables.                                                                                                                                                                                                                                                                                                    |
| `DataTable` (+ `TablePager`, `MONO_CELL`, `ROW_REVEAL`) | Lists: sticky header on `--wy-surface-2`, nowrap 13px cells, `mono` columns, density, a 3px accent focus bar on the row holding keyboard focus (>= 3:1 on every surface), and a card list below `sm`. Hover-only row controls use `ROW_REVEAL` so they also show on keyboard focus and on touch.                                              |
| `Toolbar` / `ToolbarSearch`                             | The row above a list: search + filters left, list actions right.                                                                                                                                                                                                                                                                              |
| `SubTabs`                                               | Underline tabs for more than four views inside a screen.                                                                                                                                                                                                                                                                                      |
| `SegmentedControl`                                      | Two to four short choices (24h / 7d / 30d).                                                                                                                                                                                                                                                                                                   |
| `Callout`                                               | A tinted note: `info` / `ok` / `warn` / `crit`.                                                                                                                                                                                                                                                                                               |
| `FormSection` / `FormField` / `FormSwitchRow`           | Forms: a label-over-field grid (as a `panel`, or `plain` inside a dialog), label/hint/error stacks, and labelled switch rows.                                                                                                                                                                                                                 |
| `FilterChip`                                            | A pressed/unpressed list filter.                                                                                                                                                                                                                                                                                                              |
| `EmptyState`                                            | The honest "nothing here yet" block.                                                                                                                                                                                                                                                                                                          |

`CONSOLE_STATUS_WORD` (`status.ts`) is the one default word per state.

## Migration and the style guard

The legacy screens move onto these primitives batch by batch (design review
§8). `scripts/check-console-styles.mjs` (`bun run check:console-styles`,
gated in CI) fails on `premium-card`, `rounded-2xl`/`rounded-3xl`, gradient
fills and raw Tailwind palette colours (`bg-emerald-50`, `text-amber-700`,
...) anywhere in the customer-rendered trees, except in the files listed in
`scripts/console-styles-allowlist.json`. That list only shrinks: a file
that has gone clean must come off it, or the check fails as stale.

Migrated so far: batch 1 (2026-10-31) -- Network › IP Addresses, Network
Zones, Port Forwarding, Call Priority, and Home › Alerts.
