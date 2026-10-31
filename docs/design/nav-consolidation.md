# Customer sidebar: sections with tabs

Status: built locally on `dashboard-revamp-nav` (not pushed). Owner request,
2026-10-31: "the sidebar shows too many options -- put them inside the
relevant sections".

## Before -> after

| | Before | After |
|---|---|---|
| Sidebar rows (owner) | 29 (26 visible, Logs collapsed) + 7 group labels | **10** rows, no group labels |
| Sidebar rows (agent login) | 11 | **8** (Login Page and Security have no agent tabs) |
| Screens / feature ids | 30 | 30 -- none removed, none renamed |
| URLs | 30 | the same 30, no new routes |

Three rows stay single screens because they are the "something is wrong"
path: **Dashboard, Alerts, Fix a Problem**. Every other row is a *section*:
clicking it opens its first tab the user can see, and the page shows a tab
bar with the section's other screens.

## Mapping

Section order is sidebar order; tab order is tab-bar order. A `|` in the tab
list is a visual divider in the tab bar (sub-group label in brackets).

| Old row (old group) | New section › tab | URL (unchanged) | Feature id | Permission keys (any of) | Roles |
|---|---|---|---|---|---|
| Dashboard (Home) | **Dashboard** (single row) | `/` | `dashboard` | `dashboard.view` | owner, agent |
| Alerts (Home) | **Alerts** (single row) | `/alerts` | `alerts` | `alerts.read`, `monitoring.read` | owner, agent |
| Fix a Problem (Home) | **Fix a Problem** (single row) | `/debugging` | `debugging` | `guest_sessions.read`, `network_diagnostics.read` | owner, agent |
| Guests (Guests) | Guests › Guests | `/users` | `users` | `guest_users.read`, `guest_sessions.read` | owner, agent |
| Guest Groups (Guests) | Guests › Guest Groups | `/teams` | `teams` | `guest_teams.read` | owner |
| Vouchers (Guests) | Guests › Vouchers | `/guest-vouchers` | `vouchers` | `voucher.read` | owner, agent |
| Reports (Guests) | Guests › Reports | `/reports` | `reports` | `reports.read`, `analytics.read` | owner, agent |
| Guest Messaging (Guests) | **Marketing** › Guest Messaging (add-on badge) | `/marketing` | `marketing` | `marketing.read` | owner, agent |
| Login Page Offers (Login Page) | **Marketing** › Login Page Offers | `/guest-campaigns` | `campaigns` | `campaigns.read` | owner |
| Portal (Login Page) | Login Page › Portal | `/guest-portal` | `portal` | `captive_portal.read` | owner |
| Open Hours (Login Page) | Login Page › Open Hours | `/business-hours` | `business-hours` | `captive_portal.read` | owner |
| Devices (Network) | Network › Devices | `/devices` | `devices` | `monitored_hardware.read` | owner, agent |
| Internet Connection (Network) | Network › Internet Connection | `/isp-details` | `isp-details` | `isp.read` | owner |
| Traffic Lens (Network) | Network › Traffic Lens (add-on badge) | `/traffic-lens` | `traffic-lens` | `venue_traffic.read` | owner |
| IP Addresses (Network) | Network › \| [Advanced] IP Addresses | `/dhcp` | `dhcp` | `dhcp.read` | owner |
| Network Zones (Network) | Network › [Advanced] Network Zones | `/vlans` | `vlans` | `vlan.read` | owner |
| Port Forwarding (Network) | Network › [Advanced] Port Forwarding | `/port-forwarding` | `port-forwarding` | `firewall.read` | owner |
| Call Priority (Network) | Network › [Advanced] Call Priority | `/voip` | `voip` | `qos.read` | owner |
| Security Score (Security) | Security › Security Score | `/security` | `security` | `security.read` | owner |
| Block Websites (Security) | Security › Block Websites | `/blocking` | `blocking` | `content_filtering.read`, `guest_access.read` | owner |
| Firewall (Security) | Security › Firewall | `/firewall` | `firewall` | `firewall.read` | owner |
| Access Rules (Security) | Security › \| [Who can connect] Access Rules | `/policies` | `policies` | `policy.read` | owner |
| Guest Allow-list (Security) | Security › [Who can connect] Guest Allow-list | `/whitelist` | `whitelist` | `guest_access.read` | owner |
| Trusted Devices (Security) | Security › [Who can connect] Trusted Devices | `/mac-auth` | `mac-auth` | `mac_authorization.read` | owner |
| Staff Activity (Logs) | Logs › Staff Activity | `/admin-logs` | `admin-logs` | `audit_logs.read` | owner |
| Guest Connection Records (Logs) | Logs › Guest Connection Records | `/network-activity` | `network-activity` | `guest_sessions.read` | owner |
| NetLogs (Logs) | Logs › NetLogs | `/netlogs` | `netlogs` | `network_logs.read` | owner, agent |
| Support Tickets (Help) | Help › Support Tickets | `/tickets` | `tickets` | `support_tickets.read` | owner, agent |
| How It Works (Help) | Help › How It Works | `/how-it-works` | `how-it-works` | none (always shown) | owner, agent |
| Staff Access (avatar menu) | unchanged: avatar menu, palette | `/agents` | `agents` | `users.read` | owner |

Sidebar row icons: Dashboard `LayoutDashboard`, Alerts `Bell`, Fix a Problem
`Wifi`, Guests `Users`, Marketing `Megaphone`, Login Page `Palette`,
Network `Network`, Security `ShieldCheck`, Logs `ScrollText`, Help
`LifeBuoy` -- ten different glyphs, so the collapsed rail stays readable.

## Why Marketing is its own row (and takes Login Page Offers)

Guest Messaging is a paid add-on, and its spec (D5) says a customer cannot ask
for a feature they cannot see. Folded in as the fifth tab of Guests, the
add-on badge would only be seen by someone already on a Guests page. A
Marketing row keeps it one click from anywhere.

Login Page Offers goes with it: to a venue owner both are "promote something
to my guests", one by message after the visit, one on the login page during
it. They stay two separate screens (separate tabs, separate consent and send
lifecycle, as before), so nothing about either product is merged -- they
just sit next to each other. Login Page keeps the two settings for the page
itself (design and opening hours).

Open question for the owner: if Offers should stay under Login Page, it is a
one-line move in `customerNav.ts` (and Marketing would be a single-tab row).

## Rules this implements

- **One structure.** `CUSTOMER_NAV_GROUPS` (customerNav.ts) *is* the section
  list. A group with `presentation: "rows"` (Home) puts each item in the
  sidebar as its own row; every other group is one sidebar row whose items
  are its tabs. The sidebar, tab bar, breadcrumb, palette and How It Works
  all read it, so they cannot drift.
- **Visibility per tab, unchanged.** A tab shows exactly when its row would
  have shown: role filter (`customerSidebarGroupsForRole`) then real grants
  (`filterNavGroupsByPermissions`, fail-open on absent/failed/empty). A
  section whose tabs are all filtered out disappears.
- **The sidebar row links to the first visible tab.** An agent's Marketing
  row opens Guest Messaging; a role holding only `campaigns.read` opens
  Login Page Offers.
- **Hidden tab opened by URL.** If the caller's *real* grant set (present,
  non-empty) excludes the requested screen and the section has a visible
  tab, the page redirects (replace) to the first visible tab. If nothing in
  the section is visible, or the screen is hidden only by the login-role
  radio (not an authorization decision, see customerNavPermissions.ts), the
  page renders as it always has and the tab bar shows the current screen as
  the active tab -- never a blank page and never a tab bar that omits where
  you are.
- **Controller-managed venues.** Unsupported tabs are muted with the reason
  as their title, exactly like the old rows. A sidebar row is muted only when
  every visible tab in it is unsupported; the one-line reason under the menu
  is kept.
- **Add-on badges** sit on the Guest Messaging and Traffic Lens tabs, in the
  rail flyout, and on a sidebar row when every visible tab in it is a locked
  add-on (an agent's Marketing row).
- **"N hidden by your permissions"** still counts screens (tabs), and still
  names them on hover.
- **Routes:** no new route, no section-landing URL, `routeTree.gen.ts`
  untouched. Every old URL renders the same page with the tab bar on top and
  the matching tab active. Back/forward and deep links are per tab because
  every tab is its own route.
- **Breadcrumb:** `Section › Tab` (`Home › Alerts` for the three single rows).
- **Command palette:** still lists all 30 screens by their own name, grouped
  by section, plus per-screen synonyms (`keywords`), e.g. "vouchers",
  "coupon", "access code" all find Guests › Vouchers.
- **Collapsed rail:** one icon per row; hovering a section shows its tabs as
  links in the tooltip flyout. Keyboard users get the row link (first tab)
  and the tab bar.
- **Logs collapsed-by-default is retired**: Logs is one row now, so there is
  nothing to collapse. The `cg_sidebar_group_open:*` localStorage key is no
  longer read or written.
- Mobile drawer, Cmd/Ctrl-B, `aria-current`, focus rings, Staff Access in
  the avatar menu, and the console colours are unchanged.
