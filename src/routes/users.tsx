import { useState, useMemo } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
  Download,
  Smartphone,
  Clock,
  LockOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/useFormat";
import i18n from "@/lib/i18n";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import { useCustomerPageScope } from "@/components/customer/CustomerPageScope";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  SegmentedControl,
  StatTile,
  StatusBadge,
  StatusDot,
  TablePager,
  Toolbar,
  ToolbarSearch,
  type ConsoleStatus,
} from "@/components/customer/console";
import { SectionTabs } from "@/components/customer/console/SectionTabs";
import {
  CustomerCommandPalette,
  useCustomerCommandPalette,
} from "@/components/customer/CustomerCommandPalette";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GuestHistoryDrawer } from "@/components/guests/GuestHistoryDrawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import {
  useCustomerUsers,
  useCustomerOnlineNow,
  useDisconnectSession,
  useExtendSession,
  useIsDemo,
  useDataMasking,
} from "@/hooks/useCustomerDashboard";
import type { AppError } from "@/services/api";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import {
  maskEmail,
  maskMac,
  maskPhone,
  DEMO_PLAN_RENEWAL_ISO,
} from "@/components/features/HeaderControls";
import { customerService } from "@/services/customer.service";
import type { CustomerUsersData } from "@/services/customer.service";
import { toCsv, downloadCsv, csvDateStamp } from "@/lib/csv-export";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { customerFeatureHref } from "@/lib/customerNav";
import { useClientControls, useDeviceActions } from "@/hooks/useClientControls";
import { NAS_ONLY_DATA_USAGE_UNREPORTED, isNasOnlyVendor } from "@/lib/router-vendors";
import { disconnectOutcome } from "@/lib/omada-client-controls";
import { GuestDeviceControls, isSendableMac } from "@/components/customer/GuestDeviceControls";
import { useGuestUnblock } from "@/hooks/useGuestUnblock";
import { blocksForGuest, unblockRefusal } from "@/lib/guest-unblock";

/** A guest's initials for the avatar. */
function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}

/** The row status the users service reports, as a console status. */
const GUEST_STATUS: Record<string, ConsoleStatus> = {
  online: "ok",
  idle: "warn",
  offline: "offline",
};

/* Table dates: one short line ("31 Oct, 1:39 pm"); the full stamp, with the
 * year, is the cell's tooltip and the visit slide-over's (`@/lib/format`). */

/** One labelled fact in the visit slide-over. */
const DETAIL_TILE =
  "rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] p-3";
const DETAIL_LABEL = "text-[11px] font-medium text-[var(--wy-text-faint)]";

export const Route = createFileRoute("/users")({
  // See customer.index.tsx's identical comment: activeLocationId only
  // hydrates from localStorage client-side, so this guard must not run
  // during SSR.
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: CustomerUsersPage,
});

function CustomerUsersPage() {
  const { t } = useTranslation("guests", { i18n });
  const fmt = useFormat();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeLocation, activeLocationId } = useCustomerStore();
  // beforeLoad's requireActiveLocationId() already guarantees this is set
  // before the component ever mounts.
  const locationId = activeLocationId!;
  const disconnect = useDisconnectSession();
  const extend = useExtendSession();
  // What "Disconnect" actually does at THIS venue. At a MikroTik venue -- and
  // at a mixed venue, and at one whose routers could not be read -- the
  // verdict is `available` with a null reason, and every line below that reads
  // it renders exactly as it did before this hook existed.
  const clientControls = useClientControls();
  const disconnectVerdict = clientControls.verdict("disconnect");
  const disconnectReachesDevice = disconnectVerdict.availability === "available";
  // Only at a NAS-only venue (Aruba Instant On) is Disconnect greyed outright:
  // there is no controller API and no CoA, so the device stays online whatever
  // we do, and ending our own record would make this list say they left.
  // Omada and MikroTik venues keep the button exactly as before.
  const disconnectUnsupported = isNasOnlyVendor(clientControls.vendor);
  // Per-session data at a NAS-only venue: bytes arrive only through RADIUS
  // accounting interims, which are unverified on Instant On (PM_SPEC V3). A
  // session with nothing recorded is "not reported" (U5), never a measured
  // "0 MB". Every other venue renders the value exactly as before.
  const sessionDataCell = (download: string) =>
    disconnectUnsupported && download === "0 MB" ? (
      <span title={NAS_ONLY_DATA_USAGE_UNREPORTED} data-testid="data-unreported">
        —
      </span>
    ) : (
      download
    );
  // The venue-scoped client routes, bound to the active location. Used for the
  // per-device panel below and -- only when the session-level disconnect comes
  // back NOT enforced -- as a second, MAC-keyed attempt. Never on the happy
  // path: `POST /guest-sessions/{id}/disconnect` already reaches this venue's
  // controller (backend `end_on_router` routes a controller-managed router to
  // `_end_on_controller`), so calling both every time would be two controller
  // round-trips for one guest.
  const deviceActions = useDeviceActions();
  // Row-level Unblock for a blocked guest (lib/guest-unblock.ts): the
  // front desk's way to lift a block at its own venue. Offered only when
  // this guest IS blocked here, and only to a caller holding
  // guest_access.update; the backend checks both again.
  const guestUnblock = useGuestUnblock();
  const handleUnblock = (name: string, rules: { id: string; kind: "identifier" | "device" }[]) => {
    Promise.all(rules.map((r) => guestUnblock.unblock.mutateAsync(r)))
      .then(() => toast.success(t("unblocked", { name })))
      .catch((err: AppError) => toast.error(err?.message || t("unblockFailed")));
  };
  // useIsDemo(), not isDemo() directly -- see the identical fix in
  // customer.$locationId.$feature.tsx/dashboard.tsx: calling isDemo()
  // straight in render flips between the SSR pass (no window -> false)
  // and the client's first hydration pass (real token -> true), which
  // changes whether PlanRenewalTicket's chip renders and threw a real
  // "Hydration failed" (#418) on every hard load of this page.
  const demoFlag = useIsDemo();
  const billing = useMyBillingDashboard(
    demoFlag ? undefined : activeLocation?.organizationId,
    activeLocation?.organizationName,
  );
  const planExpiryIso = demoFlag ? DEMO_PLAN_RENEWAL_ISO : billing.data?.renewalDate;
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "online" | "offline">("all");
  // The page's one header: the same nav label (and translation) the sidebar
  // row that led here shows, with the venue beside it.
  const pageScope = useCustomerPageScope("users", activeLocation?.name);
  const [page, setPage] = useState(0);
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCustomerCommandPalette();
  const dataMasking = useDataMasking();
  const masked = dataMasking.masked;
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    mac: string;
    ip: string;
    device: string;
    duration: string;
    connectedAt: string;
    disconnectedAt: string | null;
    download: string;
    status: string;
    guestId: string | null;
    mergedSessionCount?: number;
  } | null>(null);
  // The full connection-history drawer (QA: click a user -> details + a log
  // of its connections). Opened from the visit slide-over; the drawer then
  // owns the screen, showing the guest's whole story across page boundaries.
  const [historyUser, setHistoryUser] = useState<{
    guestId: string | null;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{
    id: string;
    name: string;
    guestId: string | null;
    /** The device address, carried so a disconnect the session route could
     * not enforce can be retried against the controller by MAC. The table
     * writes the literal "Unknown" when a session has none. */
    mac: string;
  } | null>(null);
  const PAGE_SIZE = 8;

  const { data, isLoading, refetch } = useCustomerUsers(locationId, {
    search: search || undefined,
    status: statusTab !== "all" ? statusTab : undefined,
    page: page + 1,
    pageSize: PAGE_SIZE,
  });
  // Real, location-wide count -- independent of this page's search/tab/
  // pagination state, see useCustomerOnlineNow's own docstring.
  const onlineNow = useCustomerOnlineNow(locationId);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  /**
   * Export the guest list the venue is currently looking at.
   *
   * The site sells this as "Full history of every guest, ready to check or
   * download anytime", and until now the only way to get a guest list out
   * of the product was the Reports screen -- this table had no export at
   * all.
   *
   * Exports what the CURRENT FILTERS SELECT, not the page on screen. The
   * table pages at 8 rows, and a "download" that silently handed over 8 of
   * 400 guests would be worse than none: it looks complete. So this pages
   * through the same query the table uses.
   *
   * The server caps page_size at 100, so this walks pages up to a bound
   * rather than asking for everything at once. If a venue has more guests
   * than the bound, the file says so in a trailing note rather than
   * quietly truncating -- the failure mode to avoid is a venue reconciling
   * against a file they believe is complete.
   *
   * Masking is respected because it is applied server-side: `phone` and
   * `email` arrive already masked unless this account has unmasked itself
   * via OTP, so an export can never leak more than the screen shows. The
   * client-side `masked ?` conditional below mirrors the table for the
   * same belt-and-braces reason it exists there.
   */
  const EXPORT_PAGE_SIZE = 100;
  const EXPORT_MAX_PAGES = 50; // 5,000 rows
  const [exporting, setExporting] = useState(false);

  const exportGuests = async () => {
    setExporting(true);
    try {
      const rows: CustomerUsersData["users"] = [];
      let truncated = false;
      for (let p = 1; p <= EXPORT_MAX_PAGES; p++) {
        const chunk = await customerService.getUsers(
          locationId,
          search || undefined,
          statusTab !== "all" ? statusTab : undefined,
          p,
          EXPORT_PAGE_SIZE,
        );
        rows.push(...chunk.users);
        if (rows.length >= chunk.total) break;
        if (p === EXPORT_MAX_PAGES && rows.length < chunk.total) truncated = true;
      }

      if (rows.length === 0) {
        toast.info(t("exportNothing", "Nothing to export for these filters."));
        return;
      }

      const header = [
        "Name",
        "Email",
        "Phone",
        "Device",
        "MAC",
        "IP",
        "Duration",
        "Connected at",
        "Disconnected at",
        "Downloaded",
        "Status",
      ];
      const body = rows.map((u) => [
        u.name,
        masked ? maskEmail(u.email) : u.email,
        masked ? maskPhone(u.phone) : u.phone,
        u.device,
        u.mac,
        u.ip,
        u.duration,
        u.connectedAt,
        u.disconnectedAt ?? "",
        u.download,
        u.status,
      ]);

      let csv = toCsv(header, body);
      if (truncated) {
        csv += `\n\nNOTE: this export stopped at ${rows.length} rows. Narrow the date range or filters, or ask support for a full extract.`;
      }
      downloadCsv(`guests-${csvDateStamp()}.csv`, csv);
      toast.success(t("exportSuccess", { count: rows.length }));
    } catch {
      toast.error(t("exportFailed", "Could not build the export. Nothing was changed."));
    } finally {
      setExporting(false);
    }
  };
  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };
  const handleSwitchLocation = () => {
    navigate({ to: "/switch-location" });
  };

  // Extend session -- guestService.extendSession() (via useExtendSession())
  // has no demo-mode guard of its own (see that hook's own docstring), so
  // this checks demoFlag itself before ever calling `.mutate()`, same
  // pattern as DebuggingView's resetSession() checking `demo` before its
  // own terminateSession() call.
  const handleExtend = (sessionId: string, minutes: number) => {
    if (demoFlag) {
      toast.error(t("demoBlocked"));
      return;
    }
    extend.mutate(
      { sessionId, additionalMinutes: minutes },
      {
        onSuccess: () => toast.success(t("extendSuccess", { minutes })),
        onError: (err) => toast.error((err as unknown as AppError).message || t("extendError")),
      },
    );
  };

  return (
    // `wy-console`: the console tokens, which also supply the accent the
    // inline `--primary: #6C4EFF` override here used to.
    <SidebarProvider className="wy-console bg-[var(--wy-bg)]">
      {/* Same shared sidebar every other customer page uses -- this page
          used to hand-roll its own flat copy with a hardcoded
          `item.id === "users"` active check, which is the drift that
          component was extracted to prevent. Open/collapsed state and the
          mobile drawer now belong to SidebarProvider, so there is no scrim
          or local state here any more. */}
      <CustomerSidebar
        activeFeatureId="users"
        subtitle={activeLocation?.name}
        dataMasking={dataMasking}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* No `title`: the breadcrumb already names this page (Guests), and
            a second label beside it read "Guests › Guests Connected guests". */}
        <CustomerHeader
          locationId={locationId}
          planExpiryIso={planExpiryIso}
          onOpenSearch={() => setPaletteOpen(true)}
          onRefresh={() => refetch()}
          user={user}
          onSwitchLocation={handleSwitchLocation}
          onChangePassword={() => setChangePwOpen(true)}
          onTfaSettings={() => setTfaOpen(true)}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-4">
            {/* Guests › Guests: this page's own row is the Guests section,
                and its siblings (Guest Groups, Vouchers, Reports) are tabs.
                The PageHeader is the page's one title; the venue chip beside
                it is deliberate -- see CustomerPageScope. */}
            <SectionTabs featureId="users" />
            <PageHeader
              title={pageScope.title}
              venue={pageScope.venue}
              description={t("pageDescription")}
            />
            {/* Previously 4 tiles (On this page/Online/Idle/Offline)
             * computed from data.users -- but that's only the current
             * paginated slice (8 rows), not this location's real totals,
             * so "Online: 3" silently meant "3 of the 8 rows on THIS page"
             * while reading as a location-wide live count. Collapsed down
             * to just "Total guests" at the time.
             *
             * "Online now" restores a real online count -- but unlike that
             * removed tile, this one is genuinely location-wide (server-
             * side `status=active` total via useCustomerOnlineNow, not a
             * client-side count of the current page), which is exactly the
             * total-vs-currently-online distinction that was causing
             * confusion. */}
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <StatTile
                label={t("totalGuests")}
                // Distinct guests on file at this location -- the raw
                // session total counts every reconnect (QA). The guests
                // lookup failing leaves it undefined; fall back to the
                // visit total rather than showing a bare dash.
                value={data ? fmt.integer(data.uniqueGuests ?? data.total) : null}
                loading={isLoading}
              />
              <StatTile
                label={t("onlineNow")}
                leading={
                  <StatusDot
                    status={(onlineNow.data ?? 0) > 0 ? "ok" : "offline"}
                    label={t("onlineNow")}
                    pulse={(onlineNow.data ?? 0) > 0}
                    size="sm"
                  />
                }
                value={fmt.integer(onlineNow.data ?? 0)}
                loading={onlineNow.isLoading}
              />
            </div>

            <Panel flush>
              <Toolbar
                divided
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 sm:h-9"
                    disabled={exporting || !data || data.total === 0}
                    onClick={exportGuests}
                  >
                    <Download className="mr-1.5 h-4 w-4" aria-hidden />
                    {exporting ? t("exporting", "Exporting…") : t("exportCsv", "Export CSV")}
                  </Button>
                }
              >
                <ToolbarSearch
                  placeholder={t("searchPlaceholder")}
                  value={search}
                  onValueChange={(v) => {
                    setSearch(v);
                    setPage(0);
                  }}
                />
                <SegmentedControl
                  ariaLabel={t("statusFilter")}
                  size="md"
                  value={statusTab}
                  onChange={(tab) => {
                    setStatusTab(tab);
                    setPage(0);
                  }}
                  options={[
                    { value: "all", label: t("tabAll") },
                    { value: "online", label: t("tabOnline") },
                    { value: "offline", label: t("tabOffline") },
                  ]}
                />
              </Toolbar>
              {/* A card per visit below `sm` (the review found the Status
                  column clipped at 390px); the columns shed as the table
                  narrows, so Status and the row actions never scroll out of
                  view. IP and Disconnected-at live in the visit slide-over
                  and the CSV, where they always were too. Clicking a row (or Enter
                  on it) opens the visit, same as the eye button. */}
              <DataTable
                ariaLabel={t("tableLabel")}
                rows={data?.users ?? []}
                rowKey={(u) => u.id}
                loading={isLoading}
                loadingLabel={t("loading")}
                empty={
                  <EmptyState
                    icon={Users}
                    title={search || statusTab !== "all" ? t("emptyNoMatch") : t("emptyNone")}
                  />
                }
                onRowClick={(u) => setDetailUser(u)}
                rowLabel={(u) => t("viewGuestDetails", { name: u.name })}
                actionsLabel={t("colActions")}
                columns={[
                  {
                    id: "user",
                    header: t("colUser"),
                    mobile: "title",
                    cell: (u) => (
                      <div className="flex min-w-0 max-w-[13rem] items-center gap-2.5">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="bg-[var(--wy-accent-soft)] text-[11px] font-semibold text-[var(--wy-accent)]">
                            {initials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name}</p>
                          <p className="truncate text-xs font-normal text-[var(--wy-text-muted)]">
                            {masked ? maskEmail(u.email) : u.email}
                          </p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "phone",
                    header: t("colPhone"),
                    mono: true,
                    visibleFrom: "lg",
                    cell: (u) => (masked ? maskPhone(u.phone) : u.phone),
                  },
                  {
                    id: "mac",
                    header: t("colMac"),
                    mono: true,
                    visibleFrom: "xl",
                    mobile: "hidden",
                    // "Unknown" is the service's honest marker for a
                    // session whose device could not be resolved. Render it
                    // as muted prose, not in the mono face the real
                    // addresses use, so it cannot be misread as a value --
                    // and so it is visibly different from a MAC that is
                    // simply short. maskMac is a no-op (see lib/masking.ts),
                    // so nothing here is hidden.
                    cell: (u) =>
                      u.mac === "Unknown" ? (
                        <span className="font-sans text-[13px] text-[var(--wy-text-muted)]">
                          {t("noDevice", "No device on record")}
                        </span>
                      ) : masked ? (
                        maskMac(u.mac)
                      ) : (
                        u.mac
                      ),
                  },
                  {
                    id: "device",
                    header: t("colDevice"),
                    visibleFrom: "2xl",
                    cell: (u) => u.device,
                  },
                  {
                    id: "duration",
                    header: t("colDuration"),
                    // Honest about a grouped display row -- see
                    // groupFragmentedVisits()'s own docstring: this is one
                    // visit built from N real, separately-accounted
                    // GuestSession rows (a reconnect blip a few minutes
                    // apart), not a fabricated single session.
                    cell: (u) => (
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        {u.duration}
                        {!!u.mergedSessionCount && u.mergedSessionCount > 1 && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1.5 text-[11px] font-normal"
                            title={t("reconnectsTooltip", { count: u.mergedSessionCount })}
                          >
                            ×{u.mergedSessionCount}
                          </Badge>
                        )}
                      </span>
                    ),
                  },
                  {
                    id: "connectedAt",
                    header: t("colConnectedAt"),
                    visibleFrom: "xl",
                    mobile: "hidden",
                    className: "tabular-nums text-[var(--wy-text-muted)]",
                    cell: (u) => (
                      <time
                        dateTime={u.connectedAt}
                        title={fmt.dateTime(u.connectedAt, { withYear: true })}
                      >
                        {fmt.dateTime(u.connectedAt)}
                      </time>
                    ),
                  },
                  {
                    id: "download",
                    header: t("colDownload"),
                    visibleFrom: "2xl",
                    mobile: "hidden",
                    className: "tabular-nums",
                    cell: (u) => sessionDataCell(u.download),
                  },
                  {
                    id: "status",
                    header: t("colStatus"),
                    cell: (u) => (
                      <StatusBadge
                        status={GUEST_STATUS[u.status] ?? "offline"}
                        pulse={u.status === "online"}
                        className="capitalize"
                      >
                        {u.status === "online"
                          ? t("statusOnline")
                          : u.status === "idle"
                            ? t("statusIdle")
                            : t("statusOffline")}
                      </StatusBadge>
                    ),
                  },
                ]}
                rowActions={(u) => (
                  <>
                    {/* An icon-only button with no text child and no label
                      has NO accessible name at all: a screen reader
                      announces "button", once per row, and the two beside it
                      (Extend, Disconnect) both carry a `title` while this one
                      carried nothing. The name includes the guest, because a
                      table of these is read row by row and "View details"
                      eleven times identifies none of them. `title` stays
                      generic so the sighted tooltip matches its two
                      neighbours. */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t("viewDetails")}
                      aria-label={t("viewGuestDetails", { name: u.name })}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailUser(u);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    {(() => {
                      if (!guestUnblock.offered) return null;
                      const blocks = blocksForGuest(u, guestUnblock.rules, locationId || null);
                      if (blocks.length === 0) return null;
                      const liftable = blocks.filter(
                        (b) => !unblockRefusal(b, guestUnblock.venueScoped),
                      );
                      if (liftable.length < blocks.length) {
                        // A ban on every venue: only an organization
                        // account may lift it (the backend refuses a venue
                        // account). Say so instead of offering a button
                        // that would 403.
                        return (
                          <span
                            data-testid="guest-blocked-everywhere"
                            title={t("blockedEverywhereTitle")}
                          >
                            <StatusBadge status="crit">{t("blockedEverywhere")}</StatusBadge>
                          </span>
                        );
                      }
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 px-2 text-xs"
                          data-testid="guest-unblock"
                          disabled={guestUnblock.unblock.isPending}
                          aria-label={t("unblockGuest", { name: u.name })}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnblock(u.name, liftable);
                          }}
                        >
                          <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
                          {t("unblock")}
                        </Button>
                      );
                    })()}
                    {u.status !== "offline" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={extend.isPending}
                            title={t("extend")}
                            aria-label={t("extend")}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="wy-console"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem onClick={() => handleExtend(u.id, 30)}>
                            {t("extend30")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExtend(u.id, 60)}>
                            {t("extend60")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {/* A NAS-only venue (Aruba Instant On): nothing can end
                     * the device's connection, and ending only our record
                     * would show an online guest as gone. Greyed with
                     * PM_SPEC U2; the title is on the wrapper because a
                     * disabled button takes no pointer events. The live
                     * button below is `hidden` there and untouched
                     * everywhere else. */}
                    {disconnectUnsupported && (
                      <span title={disconnectVerdict.reason ?? undefined}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 disabled:text-[var(--wy-text-faint)]"
                          disabled
                          aria-label={disconnectVerdict.reason ?? t("disconnect")}
                          data-testid="disconnect-unsupported-icon"
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[var(--wy-crit)] disabled:text-[var(--wy-text-faint)]"
                      hidden={disconnectUnsupported}
                      disabled={u.status === "offline" || disconnect.isPending}
                      title={u.status === "offline" ? t("alreadyOffline") : t("disconnect")}
                      aria-label={`${u.status === "offline" ? t("alreadyOffline") : t("disconnect")}: ${u.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDisconnect({
                          id: u.id,
                          name: u.name,
                          guestId: u.guestId,
                          mac: u.mac,
                        });
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </>
                )}
                footer={
                  totalPages > 1 ? (
                    <TablePager
                      // "11 users" beside a "Total guests" tile reading 4,
                      // on the same screen, for the same venue. Both numbers
                      // were right and one of them was mislabelled:
                      // `data.total` is the count of SESSION ROWS, so a guest
                      // who reconnects seven times is seven of the eleven.
                      // The rows in this table are sessions, so the footer
                      // keeps counting them and says which they are, with the
                      // distinct-guest figure beside it. `uniqueGuests` is
                      // optional (the guests lookup can fail); when it is
                      // missing we say only the part we can see.
                      summary={
                        <>
                          {data?.uniqueGuests === undefined
                            ? t("sessionsCount", { count: data?.total ?? 0 })
                            : t("sessionsFromGuests", {
                                sessions: t("sessionsCount", { count: data.total }),
                                guests: t("guestsCount", { count: data.uniqueGuests }),
                              })}
                          {" · "}
                          {t("pageOf", { page: page + 1, pages: totalPages })}
                        </>
                      }
                      previousLabel={
                        <>
                          <ChevronLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
                          {t("pagePrevious")}
                        </>
                      }
                      nextLabel={
                        <>
                          {t("pageNext")}
                          <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                        </>
                      }
                      hasPrevious={page > 0}
                      hasNext={page < totalPages - 1}
                      onPrevious={() => setPage(page - 1)}
                      onNext={() => setPage(page + 1)}
                    />
                  ) : undefined
                }
              />
            </Panel>
          </div>
        </main>
      </div>

      {/* Detail slide-over */}
      <AnimatePresence>
        {detailUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setDetailUser(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="wy-console fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-[var(--wy-border)] bg-[var(--wy-bg)] text-[var(--wy-text)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--wy-border)] bg-[var(--wy-surface)] p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-[var(--wy-accent-soft)] font-semibold text-[var(--wy-accent)]">
                      {initials(detailUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{detailUser.name}</p>
                    <p className="text-xs text-[var(--wy-text-muted)]">
                      {masked ? maskEmail(detailUser.email) : detailUser.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {detailUser.guestId && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryUser({
                          guestId: detailUser.guestId,
                          title: detailUser.name,
                          subtitle: masked ? maskEmail(detailUser.email) : detailUser.email,
                        });
                        setDetailUser(null);
                      }}
                      className="h-9 rounded-[var(--wy-radius)] px-2 text-xs font-medium text-[var(--wy-accent)] hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                    >
                      {t("fullHistory", "Full history")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailUser(null)}
                    aria-label={t("closeDetails")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--wy-radius)] text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <div className={cn(DETAIL_TILE, "flex items-center justify-between gap-3")}>
                  <p className={DETAIL_LABEL}>{t("detailStatus")}</p>
                  <StatusBadge
                    status={GUEST_STATUS[detailUser.status] ?? "offline"}
                    pulse={detailUser.status === "online"}
                    className="capitalize"
                  >
                    {detailUser.status === "online"
                      ? t("statusOnline")
                      : detailUser.status === "idle"
                        ? t("statusIdle")
                        : t("statusOffline")}
                  </StatusBadge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={DETAIL_TILE}>
                    <p className={DETAIL_LABEL}>{t("detailDuration")}</p>
                    <p className="mt-1 text-sm font-semibold">{detailUser.duration}</p>
                    {!!detailUser.mergedSessionCount && detailUser.mergedSessionCount > 1 && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t("reconnectsAcross", { count: detailUser.mergedSessionCount })}
                      </p>
                    )}
                  </div>
                  <div className={DETAIL_TILE}>
                    <p className={DETAIL_LABEL}>{t("detailDevice")}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                      <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      {detailUser.device}
                    </p>
                  </div>
                  <div className={cn(DETAIL_TILE, "col-span-2")}>
                    <p className={DETAIL_LABEL}>{t("detailDataUsed")}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                      <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      {sessionDataCell(detailUser.download)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={DETAIL_TILE}>
                    <p className={DETAIL_LABEL}>{t("detailConnectedAt")}</p>
                    <p className="mt-1 text-sm font-semibold">
                      {fmt.dateTime(detailUser.connectedAt, { withYear: true })}
                    </p>
                  </div>
                  <div className={DETAIL_TILE}>
                    <p className={DETAIL_LABEL}>{t("detailDisconnectedAt")}</p>
                    <p className="mt-1 text-sm font-semibold">
                      {detailUser.disconnectedAt
                        ? fmt.dateTime(detailUser.disconnectedAt, { withYear: true })
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className={DETAIL_TILE}>
                  <p className={DETAIL_LABEL}>{t("detailPhone")}</p>
                  <p className="mt-1 text-sm">
                    {masked ? maskPhone(detailUser.phone) : detailUser.phone}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className={DETAIL_TILE}>
                    <p className={DETAIL_LABEL}>{t("detailMac")}</p>
                    <p className="mt-1 font-mono text-sm">
                      {masked ? maskMac(detailUser.mac) : detailUser.mac}
                    </p>
                  </div>
                  <div className={DETAIL_TILE}>
                    <p className={DETAIL_LABEL}>{t("detailIp")}</p>
                    <p className="mt-1 font-mono text-sm">{detailUser.ip || "—"}</p>
                  </div>
                </div>
                {/* Renders NOTHING at a MikroTik venue, a mixed venue, or a
                    venue whose routers could not be read -- it returns null on
                    `controllerManaged`, so those venues issue no capability
                    read and see the panel not at all. The unmasked MAC is what
                    goes on the wire; the backend masks it on the way back. */}
                <GuestDeviceControls mac={detailUser.mac} guestName={detailUser.name} />
              </div>
              <div className="space-y-2 border-t border-[var(--wy-border)] bg-[var(--wy-surface)] p-4">
                {detailUser.status !== "offline" && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={extend.isPending}
                      onClick={() => handleExtend(detailUser.id, 30)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {t("extend30")}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={extend.isPending}
                      onClick={() => handleExtend(detailUser.id, 60)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {t("extend60")}
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full text-destructive disabled:text-muted-foreground"
                  disabled={
                    detailUser.status === "offline" || disconnect.isPending || disconnectUnsupported
                  }
                  onClick={() =>
                    setConfirmDisconnect({
                      id: detailUser.id,
                      name: detailUser.name,
                      guestId: detailUser.guestId,
                      mac: detailUser.mac,
                    })
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {detailUser.status === "offline" ? t("alreadyOffline") : t("disconnectUser")}
                </Button>
                {disconnectUnsupported && (
                  <p className="text-xs text-muted-foreground" data-testid="disconnect-unsupported">
                    {disconnectVerdict.reason}
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />

      {/* Disconnecting immediately kicked a real guest off their session
       * with a single click, no confirmation -- a misclick had a real
       * consequence for a real person. Now routed through this dialog from
       * both the table row action and the detail panel. */}
      <AlertDialog
        open={!!confirmDisconnect}
        onOpenChange={(o) => !o && setConfirmDisconnect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("confirmDisconnectTitle", { name: confirmDisconnect?.name })}
            </AlertDialogTitle>
            {/* The stock description promises the device is forced off "this
                network's router (Wi-Fi registration + DHCP lease)", which is
                exactly what happens at a MikroTik venue and exactly what does
                NOT happen at a venue whose access points are a controller --
                `/connected-devices/{id}/disconnect` refuses by vendor there
                and `disconnectSession` swallows the refusal. Promising it
                before the click and then not doing it is the defect; the
                verdict's own sentence replaces it, rather than being appended
                as a caveat to a claim we have just made. */}
            <AlertDialogDescription>
              {disconnectReachesDevice
                ? t("confirmDisconnectDescription")
                : disconnectVerdict.reason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmDisconnect) return;
                disconnect.mutate(
                  {
                    sessionId: confirmDisconnect.id,
                    guestId: confirmDisconnect.guestId,
                    locationId,
                  },
                  {
                    onSuccess: async (result) => {
                      // Honest about a partial success -- the session-level
                      // disconnect above is always real and already done by
                      // this point, but the router-level device clear is
                      // best-effort (see disconnectSession()'s docstring): a
                      // guest can have zero tracked ConnectedDevice rows if
                      // the router-sync mechanism hasn't discovered them yet.
                      //
                      // Four outcomes now, not two, and the ladder that picks
                      // between them is pure and tested rather than inline:
                      // the controller branch has to sit ABOVE the failure
                      // branch, because at a controller venue the device is
                      // never cleared on any call, and calling that "check
                      // the router and try again" sends an owner to look at
                      // hardware that is behaving correctly.
                      const name = confirmDisconnect.name;
                      const mac = confirmDisconnect.mac;
                      // A SECOND ATTEMPT, NOT A SECOND CALL ON THE HAPPY PATH.
                      //
                      // The session route above already reaches this venue's
                      // controller, so on success nothing more is asked and
                      // `controllerDisconnected` stays null -- which is also
                      // what every MikroTik venue passes, on every call,
                      // forever, and is why the outcome ladder below is
                      // unchanged for them.
                      //
                      // It is worth asking again when that route reports NOT
                      // enforced, because the two ask different questions: the
                      // session route ends by the guest's portal identifier,
                      // this one ends by MAC. A guest the controller does not
                      // know by identifier -- the missing-identifier shape
                      // this platform has hit before -- is still findable by
                      // the address it is serving.
                      let controllerDisconnected: boolean | null = null;
                      if (
                        result.sessionEnforced === false &&
                        !result.deviceDisconnected &&
                        clientControls.capabilities?.disconnect.supported === true &&
                        isSendableMac(mac)
                      ) {
                        try {
                          const facts = await deviceActions.disconnect(mac);
                          controllerDisconnected = facts.performed;
                        } catch {
                          // Leave it null rather than false: a call that never
                          // completed is not the controller saying no, and
                          // "controller-refused" would be a claim about the
                          // venue's hardware we cannot make.
                        }
                      }
                      switch (
                        disconnectOutcome({
                          sessionEnforced: result.sessionEnforced,
                          deviceDisconnected: result.deviceDisconnected,
                          controllerDisconnected,
                          verdict: disconnectVerdict,
                        })
                      ) {
                        case "device-cleared":
                          toast.success(t("disconnectSuccess", { name }));
                          break;
                        case "controller-venue":
                          toast.info(t("disconnectController", { name }));
                          break;
                        case "not-cleared":
                          toast.warning(t("disconnectPartial", { name }));
                          break;
                        case "session-only":
                          toast.warning(t("disconnectSessionOnly", { name }));
                          break;
                        case "controller-refused":
                          // We asked the venue's controller, by MAC, and it
                          // said no. Not "check the router and try again":
                          // there is no router at this venue to check.
                          toast.warning(t("disconnectControllerRefused", { name }));
                          break;
                      }
                    },
                    onError: (err) =>
                      toast.error((err as unknown as AppError).message || t("disconnectError")),
                  },
                );
                setConfirmDisconnect(null);
                setDetailUser(null);
              }}
            >
              {t("confirmDisconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CustomerCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {/* Guest detail + connection history (QA: click a user -> details + a
       * log of its connections). Org-scoped server-side history; falls back
       * to the clicked visit's own card when the row has no guest id. */}
      <GuestHistoryDrawer
        open={!!historyUser}
        onOpenChange={(open) => {
          if (!open) setHistoryUser(null);
        }}
        guestId={historyUser?.guestId ?? null}
        organizationId={activeLocation?.organizationId}
        locationId={locationId}
        masked={masked}
        seed={
          historyUser
            ? {
                guestId: historyUser.guestId,
                title: historyUser.title,
                subtitle: historyUser.subtitle,
              }
            : null
        }
      />
    </SidebarProvider>
  );
}
