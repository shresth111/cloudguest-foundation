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

| Token | Purpose | Light | Dark |
|---|---|---|---|
| `--wy-bg` | Page canvas behind panels | `#f4f5f7` | `#0d1015` |
| `--wy-surface` | Panels, sidebar, top bar, popovers | `#ffffff` | `#151921` |
| `--wy-surface-2` | Inset / hover / table header / segmented track | `#eef0f3` | `#1c212b` |
| `--wy-border` | Hairlines between and around panels | `#e3e6eb` | `#262c37` |
| `--wy-border-strong` | Inputs, focused/selected outlines, dividers that must read | `#cdd2da` | `#353d4b` |

### Text

| Token | Purpose | Light | Dark |
|---|---|---|---|
| `--wy-text` | Primary text, values | `#12161d` | `#e7eaef` |
| `--wy-text-muted` | Labels, secondary copy | `#4b5362` | `#a4acba` |
| `--wy-text-faint` | Tertiary: captions, units, group headers, timestamps | `#646c7b` | `#8a93a3` |

All three pass WCAG AA (4.5:1) on `--wy-bg`, `--wy-surface` and `--wy-surface-2`
in both themes (see table below). `faint` is still body-text legal; it is just
the quietest step.

### Accent

| Token | Purpose | Light | Dark |
|---|---|---|---|
| `--wy-accent` | Active nav, primary buttons, links, focus rings | `#4f3fe0` | `#9a8cff` |
| `--wy-accent-fg` | Text/icons on a solid `--wy-accent` fill | `#ffffff` | `#0d1015` |
| `--wy-accent-soft` | Active-row / selected background tint | `#eeecfd` | `#252447` |

Indigo-violet, the same family as the Wyfy shield mark (`#6366f1 -> #7c3aed`).

### Status

Reserved for state. Never reuse as a chart series colour. Always ship with a
label or icon (StatusDot carries an accessible label), never colour alone.
Each foreground passes AA as text on `--wy-surface`, `--wy-bg`, and on its own
`-soft` background.

| Token | Meaning | Light | Light `-soft` | Dark | Dark `-soft` |
|---|---|---|---|---|---|
| `--wy-ok` | Up, healthy, checking in | `#0f7a47` | `#e3f3ea` | `#45c98a` | `#112a1f` |
| `--wy-warn` | Degraded, late, needs attention | `#9a5b00` | `#fbf0da` | `#f0b44a` | `#2e2411` |
| `--wy-crit` | Down, failing, action required | `#c22a3d` | `#fbe8ea` | `#f4707f` | `#35181d` |
| `--wy-info` | Informational, in progress | `#0b66b0` | `#e4effa` | `#5eb0f2` | `#132638` |
| `--wy-offline` | Not applicable / unknown / no device (neutral, NOT a fault) | `#5f6776` | `#eceef2` | `#8f98a8` | `#1f242d` |

### Data-viz series

Categorical, assign in fixed order (series-1 first), never cycled; a 7th
series folds into "Other". Validated with the dataviz skill's
`validate_palette.js` (adjacent pairs): light worst CVD dE 9.1, normal-vision
dE 19.6; dark worst CVD dE 8.4, normal-vision dE 19.3. In light mode
series 3/4/5 are under 3:1 against white, so charts using them must carry
direct labels, a legend, or a table view (they always should anyway).

| Token | Hue | Light | Dark |
|---|---|---|---|
| `--wy-series-1` | blue | `#2a78d6` | `#3987e5` |
| `--wy-series-2` | orange | `#eb6834` | `#d95926` |
| `--wy-series-3` | aqua | `#1baf7a` | `#199e70` |
| `--wy-series-4` | yellow | `#eda100` | `#c98500` |
| `--wy-series-5` | magenta | `#e87ba4` | `#d55181` |
| `--wy-series-6` | violet | `#6250d6` | `#9085e9` |

Grid lines / axes: use `--wy-border` and `--wy-text-faint`. Axis and value
text wears text tokens, never the series colour.

### Shape, depth, type

| Token | Purpose | Value |
|---|---|---|
| `--wy-radius` | Panels, inputs, buttons, nav rows | `8px` |
| `--wy-radius-lg` | Dialogs, popovers, large hero panels | `12px` |
| `--wy-shadow` | Panel elevation: a hairline + faint ambient (light); hairline only feel in dark | light `0 1px 2px rgb(16 24 40 / 0.05)`; dark `0 1px 2px rgb(0 0 0 / 0.4)` |
| `--wy-font-mono` | IPs, MACs, numbers in tables, durations | `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace` |

No new web fonts: the mono stack resolves to what the OS already has.
For numbers that sit in prose or tiles, prefer `tabular-nums` on the sans
face over switching to mono.

## Type scale and density (guidance)

- Base UI text 13px (`text-[13px]`), labels 12px, captions 11px.
- Group headers / eyebrow labels: 11px, uppercase, `tracking-wider`, `--wy-text-faint`.
- Stat values: 24-28px, `font-semibold tabular-nums`.
- Nav rows 32px tall; top bar 56px; panel header 44px; panel padding 16px.

## Measured contrast (WCAG 2.x ratio)

Computed, not eyeballed (`contrast.mjs`, relative luminance formula).

| Pair | Light | Dark |
|---|---|---|
| text / surface | 18.13 | 14.60 |
| text / surface-2 | 15.88 | 13.38 |
| text-muted / surface | 7.74 | 7.70 |
| text-muted / surface-2 | 6.78 | 7.06 |
| text-faint / bg | 4.85 | 6.15 |
| text-faint / surface | 5.29 | 5.69 |
| text-faint / surface-2 | 4.63 | 5.21 |
| accent / surface | 6.73 | 6.35 |
| accent / accent-soft | 5.79 | 5.32 |
| accent-fg / accent | 6.73 | 6.87 |
| ok / ok-soft | 4.69 | 7.26 |
| warn / warn-soft | 4.80 | 8.23 |
| crit / crit-soft | 4.83 | 5.75 |
| info / info-soft | 5.09 | 6.58 |
| offline / offline-soft | 4.90 | 5.36 |
| worst status / surface-2 | 4.72 (ok) | 5.55 (offline) |

## Shared primitives

`src/components/customer/console/` (import from `@/components/customer/console`):
`StatusDot`, `StatTile`, `Panel`, `SegmentedControl`, `EmptyState`. Each has a
one-line JSDoc on its props. They read these tokens and nothing else.
