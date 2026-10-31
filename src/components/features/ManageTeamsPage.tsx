import { useEffect, useState } from "react";
import { DEMO_VENUE_NAMES } from "@/lib/demo-world";
import { Plus, Users, UserCog, Upload, UploadCloud, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Callout,
  EmptyState,
  FormField,
  FormSection,
  PageHeader,
  Panel,
  SubTabs,
  type PageScope,
} from "@/components/customer/console";
import { cn } from "@/lib/utils";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { guestService } from "@/services/guest.service";
import type { Guest, GuestTeamRosterMember } from "@/types/guest";
import { resolveOrgId } from "@/services/customer.service";

// Demo-only: the demo world's venues (`@/lib/demo-world`), so every picker
// lists the same venues as the venue switcher.
const UNITS: string[] = [...DEMO_VENUE_NAMES];

// quotaPercent is null when the team has no shared_data_limit_mb configured
// at all -- "no cap set", which is a materially different fact from "0% of
// a real cap used so far". Rendering those the same way (a 0-width bar,
// "0%") would silently misreport an unconfigured quota as an untouched one,
// so the two states get different UI treatment below (see the Quota used
// block in the Your Teams grid).
interface Team {
  id: string;
  name: string;
  businessUnit: string;
  members: number;
  quotaPercent: number | null;
  status: "active" | "expired" | "revoked";
}

const DEMO_TEAMS: Team[] = [
  {
    id: "1",
    name: "Sales Team",
    businessUnit: "Mumbai HQ",
    members: 12,
    quotaPercent: 85,
    status: "active",
  },
  {
    id: "2",
    name: "Executive VIP",
    businessUnit: "Delhi Office",
    members: 5,
    quotaPercent: 42,
    status: "active",
  },
  {
    id: "3",
    name: "Contractors",
    businessUnit: "Bangalore DC",
    members: 8,
    quotaPercent: 100,
    status: "active",
  },
];

const TABS = [
  // Was "Setup Teams" -- renamed (display-only, same tab id/state) because
  // the old label/layout read too close to a competitor's equivalent
  // feature. Same treatment as OperationsFeatures.tsx's Business Hours ->
  // Open Hours pass: new name + a real visual redesign below, zero
  // changes to createTeam/revokeTeam/guestService calls or the Team data
  // model.
  //
  // Then "Team Accounts" -> "Groups" (and the other three relabelled) so the
  // page uses the same word as its own sidebar row, "Guest Groups". A venue
  // owner who clicked "Guest Groups" and landed on "Team Accounts" had no
  // way to tell it was the same thing. "Update User Details" became "Find a
  // Guest": the tab has only ever looked a guest up (there is no guest
  // update route, see findUser below), so the old name promised an edit.
  { id: "setup", labelKey: "tabs.setup", fallback: "Groups", icon: Users },
  { id: "update", labelKey: "tabs.update", fallback: "Find a Guest", icon: UserCog },
  { id: "bulk-teams", labelKey: "tabs.bulkGroups", fallback: "Add Many Groups", icon: Upload },
  {
    id: "bulk-map",
    labelKey: "tabs.bulkMap",
    fallback: "Add Guests to Groups",
    icon: UploadCloud,
  },
] as const;
type TabId = (typeof TABS)[number]["id"];

const inputCls =
  "block h-10 w-full rounded-[var(--wy-radius)] border border-[var(--wy-border-strong)] bg-[var(--wy-surface)] px-3 text-[13px] text-[var(--wy-text)] placeholder:text-[var(--wy-text-faint)] outline-none transition-colors focus-visible:border-[var(--wy-accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wy-accent)_35%,transparent)] sm:h-9";
const labelCls = "mb-1 block text-xs font-medium text-[var(--wy-text-faint)]";

// "Download Template" used to just toast.success("Template downloaded")
// with no actual file -- a pure UI stub. Build and trigger a real CSV
// blob download instead, matching the columns each bulk-upload flow
// actually expects (team_name/business_unit/shared_users for Setup Bulk
// Teams, mobile_number/team_name/business_unit for Map Bulk Users).
function downloadCsvTemplate(filename: string, header: string[], sampleRow: string[]) {
  const csv = [header, sampleRow].map((row) => row.join(",")).join("\r\n") + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success(
    i18n.t("templateDownloaded", { ns: "guestGroups", defaultValue: "Template downloaded" }),
  );
}

function CsvDropzone({
  file,
  onFile,
  disabled = false,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("guestGroups", { i18n });
  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[var(--wy-radius)] border-2 border-dashed border-[var(--wy-border-strong)] p-6 text-center transition-colors",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-[var(--wy-accent)] hover:bg-[var(--wy-surface-2)]",
      )}
    >
      <input
        type="file"
        accept=".csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <FileSpreadsheet aria-hidden className="h-7 w-7 text-[var(--wy-text-faint)]" />
      {file ? (
        <p className="text-sm font-medium text-foreground">{file.name}</p>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">
            {disabled
              ? t("csv.unavailable", "CSV import isn't available yet")
              : t("csv.click", "Click to upload a CSV file")}
          </p>
          <p className="text-xs text-muted-foreground">
            {disabled ? t("csv.seeBelow", "See below") : t("csv.drag", "or drag and drop it here")}
          </p>
        </>
      )}
    </label>
  );
}

/**
 * The honest state for bulk import.
 *
 * WHAT THIS REPLACED: an enabled "Upload & Create" button whose entire
 * implementation was
 * `toast.success('Uploaded x.csv — teams queued for import.')`. No
 * FileReader, no parse, no request. The word "queued" made it read as a
 * job accepted for async processing, so the failure was invisible: a venue
 * uploading forty members got a green toast and forty guests who could not
 * connect. `/features` sells this as a headline capability ("Add a whole
 * group of guests at once with a spreadsheet upload").
 *
 * There is no endpoint behind it. `app/domains/guest_teams/router.py`
 * exposes exactly `/guest-teams`, `/{team_id}`, `/{team_id}/revoke`,
 * `/{team_id}/members/{guest_id}` and `/join` -- no bulk or import route
 * anywhere in the backend (the only `bulk_create` is a generic repository
 * helper, not an API). Rather than fake a queue or loop createTeam over a
 * client-parsed file and call that "import", the control says what is
 * true and points at the thing that does work today.
 *
 * The CSV template download above is deliberately left working: it is
 * real, it costs nothing, and a venue preparing data ahead of this
 * shipping is doing something useful.
 */
function BulkImportUnavailable() {
  const { t } = useTranslation("guestGroups", { i18n });
  return (
    <Callout tone="info" title={t("bulk.comingTitle", "Bulk import is coming")}>
      <p className="text-xs">
        {/* One sentence with the button name inside it, not three strings
            glued together: Hindi puts the button name in a different place
            in the sentence, so the translator needs the whole thing. */}
        <Trans
          i18n={i18n}
          t={t}
          i18nKey="bulk.comingBody"
          defaults="We haven't shipped spreadsheet import yet, so we've switched this off rather than take a file and quietly drop it. Add groups with <b>Create Group</b> above, or send us your sheet on a support ticket and we'll load it for you."
          components={{ b: <span className="font-semibold" /> }}
        />
      </p>
    </Callout>
  );
}

function QuickNotes({ items }: { items: string[] }) {
  const { t } = useTranslation("guestGroups", { i18n });
  return (
    <div className="rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]">
        {t("notes.title", "Quick Notes")}
      </p>
      <ol className="space-y-1.5 text-xs leading-relaxed text-[var(--wy-text-muted)]">
        {items.map((n, i) => (
          <li key={i}>
            {i + 1}. {n}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ManageTeamsPage({
  locationId,
  scope,
}: { locationId?: string; scope?: PageScope } = {}) {
  // `tr`, not `t`: this page already uses `t` for a Team everywhere
  // (`openManage(t)`, `revokeTeam(t)`, every `teams.map((t) => ...)`).
  const { t: tr } = useTranslation("guestGroups", { i18n });
  const demo = useIsDemo();
  // UNITS is demo-only seed data (fake hotel names) -- a real customer only
  // has their own locations, so every "Location" picker below must offer
  // those instead. Labeled "Location" (was "Business Unit" -- this page's
  // own units/realUnits is the exact same real-locations list WhiteList.tsx
  // already calls "Location" for its own identical picker; display-only
  // rename, `bu`/`businessUnit` etc. stay as-is). Same real-vs-demo split
  // as WhiteList.tsx's
  // units/realUnits.
  const { data: locations } = useCustomerLocations();
  const units = demo ? UNITS : (locations ?? []).map((l) => l.name);
  const [tab, setTab] = useState<TabId>("setup");
  const [teams, setTeams] = useState<Team[]>(demo ? DEMO_TEAMS : []);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    (async () => {
      try {
        // /me/organizations instead of the platform-wide GET /organizations
        // -- see customer.service.ts's resolveOrgId doc comment.
        const org = await resolveOrgId();
        setOrgId(org);
        const rows = await guestService.listTeams(org);
        // GET /guest-teams returns every team regardless of status (active,
        // expired, *and* revoked) -- this used to get discarded and every
        // row hardcoded to "active" here, so a team someone had already
        // revoked (see revokeTeam() below) would silently reappear as if
        // still current on the next page load/refresh. Keep the real
        // status so revoked teams stay filtered out of "Current Teams"
        // (below) instead of resurfacing.
        const base: Team[] = rows.map((t) => ({
          id: t.id,
          name: t.name,
          businessUnit: "",
          members: t.maxMembers ?? 0,
          quotaPercent: null,
          status: t.status,
        }));
        setTeams(base);

        // Quota used% used to be hardcoded to 0 here regardless of real
        // usage -- GET /guest-teams (list) never carried a summary, but
        // GET /guest-teams/:id does (guestService.getTeam), backed by a
        // real per-team aggregate (GuestTeamService.get_team_summary sums
        // every member's real session byte counts server-side, not a
        // placeholder). Fan out one detail call per listed team to pick up
        // that real figure. A team with no shared_data_limit_mb configured
        // has no cap to measure usage against at all -- keep quotaPercent
        // null for those (rendered as "No quota set", never a misleading
        // "0%") rather than pretending an unset cap means "untouched".
        const revokedOrExpired = new Set(["revoked", "expired"]);
        const withQuota = await Promise.allSettled(
          base
            .filter((t) => !revokedOrExpired.has(t.status))
            .map(async (t) => {
              const detail = await guestService.getTeam(t.id);
              if (!detail || detail.summary.sharedDataLimitMb == null) return null;
              const usedMb = detail.summary.totalBandwidthBytes / (1024 * 1024);
              const pct = Math.min(
                100,
                Math.max(0, Math.round((usedMb / detail.summary.sharedDataLimitMb) * 100)),
              );
              return { id: t.id, pct };
            }),
        );
        const pctById = new Map(
          withQuota
            .filter(
              (r): r is PromiseFulfilledResult<{ id: string; pct: number } | null> =>
                r.status === "fulfilled",
            )
            .map((r) => r.value)
            .filter((v): v is { id: string; pct: number } => v !== null)
            .map((v) => [v.id, v.pct]),
        );
        if (pctById.size) {
          setTeams((prev) =>
            prev.map((t) => (pctById.has(t.id) ? { ...t, quotaPercent: pctById.get(t.id)! } : t)),
          );
        }
      } catch {
        // Leave teams empty -- the "no teams yet" state is accurate.
      }
    })();
  }, [demo, locationId]);

  // Setup Teams form
  const [bu, setBu] = useState("");
  const [teamName, setTeamName] = useState("");
  const [sharedUsers, setSharedUsers] = useState("");
  const [sharedQuotaMb, setSharedQuotaMb] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});

  // Manage Team dialog
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  // The open team's active roster -- who is actually in the team right now,
  // each with the guest's own identifier so removal can name a real person.
  // Demo mode has no backend roster (the demo store never modelled members),
  // so it stays empty there and the members section is hidden.
  const [members, setMembers] = useState<GuestTeamRosterMember[]>([]);
  const [membersState, setMembersState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [removingGuestId, setRemovingGuestId] = useState<string | null>(null);
  const openManage = (t: Team) => {
    setManageTeam(t);
    setMembers([]);
    if (demo) {
      setMembersState("idle");
      return;
    }
    setMembersState("loading");
    (async () => {
      try {
        const roster = await guestService.listTeamMembers(t.id, orgId ?? undefined);
        setMembers(roster);
        setMembersState("loaded");
      } catch {
        setMembersState("error");
      }
    })();
  };

  const removeMember = async (guestId: string) => {
    if (!manageTeam || demo) return;
    setRemovingGuestId(guestId);
    try {
      await guestService.removeTeamMember(manageTeam.id, guestId);
      setMembers((prev) => prev.filter((m) => m.guestId !== guestId));
      toast.success(tr("toast.memberRemoved", "Member removed"));
    } catch {
      toast.error(
        tr(
          "toast.removeFailed",
          "Could not remove this member — check the connection and try again.",
        ),
      );
    } finally {
      setRemovingGuestId(null);
    }
  };

  // `saveManage` used to live here. It wrote the edited name/location/
  // member count into local `teams` state, toasted "<name> updated" and
  // closed -- with no API call anywhere. The rename looked like it worked
  // and was gone on the next refresh.
  //
  // There is nothing to wire it to: app/domains/guest_teams/router.py
  // exposes POST /guest-teams, GET /guest-teams, GET /guest-teams/{id},
  // POST /guest-teams/{id}/revoke, DELETE
  // /guest-teams/{id}/members/{guest_id} and POST /guest-teams/join --
  // no PUT and no PATCH on a team. So the dialog is read-only until a
  // team-update endpoint exists, and says so, rather than accepting edits
  // it cannot keep.

  const createTeam = async () => {
    const e: Record<string, string> = {};
    if (demo && !bu) e.bu = tr("errors.location", "Select a location.");
    if (!teamName) e.teamName = tr("errors.groupName", "Enter a group name.");
    if (sharedUsers === "" || parseInt(sharedUsers) < 0)
      e.sharedUsers = tr(
        "errors.sharedUsers",
        "Enter how many guests can join, or 0 for unlimited.",
      );
    setErrs(e);
    if (Object.keys(e).length) return;

    if (demo) {
      setTeams((t) => [
        {
          id: String(Date.now()),
          name: teamName,
          businessUnit: bu,
          members: 0,
          quotaPercent: null,
          status: "active",
        },
        ...t,
      ]);
      setTeamName("");
      setSharedUsers("");
      setSharedQuotaMb("");
      toast.success(tr("toast.created", "Group created"));
      return;
    }
    if (!orgId) {
      toast.error(tr("toast.noOrg", "No organization found for this session."));
      return;
    }
    try {
      const max = parseInt(sharedUsers) || 0;
      const quotaMb = parseInt(sharedQuotaMb) || 0;
      const created = await guestService.createTeam({
        organizationId: orgId,
        locationId: locationId ?? undefined,
        name: teamName,
        maxMembers: max > 0 ? max : undefined,
        // 0 / blank matches "Shared Users"' own 0-means-unlimited
        // convention -- no cap sent means guestService.getTeam's summary
        // comes back with sharedDataLimitMb: null (no percentage to show,
        // see the useEffect above), not a 0-used bar.
        sharedDataLimitMb: quotaMb > 0 ? quotaMb : undefined,
      });
      setTeams((t) => [
        {
          id: created.id,
          name: created.name,
          businessUnit: "",
          members: created.maxMembers ?? 0,
          quotaPercent: created.sharedDataLimitMb != null ? 0 : null,
          status: "active",
        },
        ...t,
      ]);
      setTeamName("");
      setSharedUsers("");
      setSharedQuotaMb("");
      toast.success(tr("toast.created", "Group created"));
    } catch {
      toast.error(
        tr(
          "toast.createFailed",
          "Could not create the group — check the connection and try again.",
        ),
      );
    }
  };

  const revokeTeam = async (t: Team) => {
    const prev = teams;
    setTeams((p) => p.filter((x) => x.id !== t.id));
    toast.success(tr("toast.revoked", "Group revoked"));
    if (!demo) {
      try {
        await guestService.revokeTeam(t.id, undefined, orgId ?? undefined);
      } catch {
        setTeams(prev);
        toast.error(tr("toast.revokeFailed", "Could not revoke on the server."));
      }
    }
  };

  // Update User Details form
  const [udMobile, setUdMobile] = useState("");
  // "Find User" used to be `toast.success("Looked up user -- no changes
  // yet.")` -- a button that reported a lookup it had never performed.
  // Unlike the team rename above, this one has a real endpoint behind it:
  // GET /guests?search= is a genuine server-side search (see
  // app/domains/guest/router.py's `search` query param), so the lookup is
  // now real. Editing a found guest still is not: the guest domain has
  // GET /guests/{id} and block/unblock, but no update route, so the
  // result is presented as a read-only record rather than an edit form.
  const [udLoading, setUdLoading] = useState(false);
  const [udResult, setUdResult] = useState<Guest[] | null>(null);

  const findUser = async () => {
    if (!udMobile) {
      toast.error(tr("find.enterMobile", "Enter a mobile number."));
      return;
    }
    if (demo) {
      toast.error(tr("find.demo", "Guest lookup needs a real account."));
      return;
    }
    setUdLoading(true);
    setUdResult(null);
    try {
      const org = orgId ?? (await resolveOrgId());
      const res = await guestService.list({
        organizationId: org,
        locationId: locationId ?? undefined,
        search: udMobile,
        page: 1,
        pageSize: 10,
      });
      setUdResult(res.rows);
      if (res.rows.length === 0) toast.info(tr("find.noMatch", "No guest matched that number."));
    } catch {
      toast.error(tr("find.error", "Could not search for that guest."));
    } finally {
      setUdLoading(false);
    }
  };

  // Bulk forms
  const [teamsBu, setTeamsBu] = useState("");
  const [teamsCsv, setTeamsCsv] = useState<File | null>(null);
  const [mapBu, setMapBu] = useState("");
  const [mapCsv, setMapCsv] = useState<File | null>(null);

  return (
    <div className="wy-console space-y-5">
      {/* Under the customer shell this is the page's only header (the shell
          passes the tab name and venue); the agent view mounts it bare. */}
      <PageHeader
        title={scope?.title ?? tr("title", "Guest Groups")}
        venue={scope?.venue}
        description={tr(
          "subtitle",
          "Put guests into groups that share one data allowance, and manage them together.",
        )}
      />

      <SubTabs
        ariaLabel={tr("tabs.label", "Guest group tools")}
        idPrefix="guest-groups"
        value={tab}
        onChange={setTab}
        options={TABS.map((t) => ({ value: t.id, label: tr(t.labelKey, t.fallback) }))}
      />

      <div
        role="tabpanel"
        id="guest-groups-panel"
        aria-labelledby={`guest-groups-tab-${tab}`}
        className="space-y-5"
      >
        {tab === "setup" && (
          <div className="space-y-5">
            {/* The create form, then the list of groups it makes. */}
            <FormSection
              title={tr("form.title", "Create a Group")}
              description={tr(
                "form.subtitle",
                "Create a shared group or desk account with its own member limit.",
              )}
              footer={
                <Button onClick={createTeam}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  {tr("form.create", "Create Group")}
                </Button>
              }
            >
              <FormField
                label={
                  <>
                    {tr("form.location", "Location")}{" "}
                    <span className="text-[var(--wy-crit)]">*</span>
                  </>
                }
                htmlFor="group-location"
                error={errs.bu || undefined}
              >
                <select
                  id="group-location"
                  value={bu}
                  onChange={(e) => {
                    setBu(e.target.value);
                    setErrs((p) => ({ ...p, bu: "" }));
                  }}
                  className={inputCls}
                >
                  <option value="">{tr("form.chooseLocation", "Choose location")}</option>
                  {units.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label={
                  <>
                    {tr("form.groupName", "Group Name")}{" "}
                    <span className="text-[var(--wy-crit)]">*</span>
                  </>
                }
                htmlFor="group-name"
                error={errs.teamName || undefined}
              >
                <input
                  id="group-name"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    setErrs((p) => ({ ...p, teamName: "" }));
                  }}
                  placeholder={tr("form.groupNamePlaceholder", "Enter a group name")}
                  className={inputCls}
                />
              </FormField>
              <FormField
                label={
                  <>
                    {tr("form.sharedUsers", "Number of Guests")}{" "}
                    <span className="text-[var(--wy-crit)]">*</span>
                  </>
                }
                htmlFor="group-shared-users"
                error={errs.sharedUsers || undefined}
              >
                <input
                  id="group-shared-users"
                  type="number"
                  min={0}
                  value={sharedUsers}
                  onChange={(e) => {
                    setSharedUsers(e.target.value);
                    setErrs((p) => ({ ...p, sharedUsers: "" }));
                  }}
                  placeholder={tr(
                    "form.sharedUsersPlaceholder",
                    "How many guests can join, or 0 for unlimited",
                  )}
                  className={inputCls}
                />
              </FormField>
              <FormField
                label={tr("form.sharedQuota", "Shared Data Limit (MB)")}
                htmlFor="group-shared-quota"
              >
                <input
                  id="group-shared-quota"
                  type="number"
                  min={0}
                  value={sharedQuotaMb}
                  onChange={(e) => setSharedQuotaMb(e.target.value)}
                  placeholder={tr("form.sharedQuotaPlaceholder", "Leave blank or 0 for unlimited")}
                  className={inputCls}
                />
              </FormField>
            </FormSection>

            <Panel
              title={tr("list.title", "Your Groups")}
              actions={
                teams.filter((t) => t.status !== "revoked").length > 0 ? (
                  <span className="text-xs tabular-nums text-[var(--wy-text-muted)]">
                    {tr("list.total", "{{count}} total", {
                      count: teams.filter((t) => t.status !== "revoked").length,
                    })}
                  </span>
                ) : undefined
              }
            >
              {teams.filter((t) => t.status !== "revoked").length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title={tr("list.emptyTitle", "No groups yet")}
                  description={tr("list.emptyBody", "Create one above to get started.")}
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {teams
                    .filter((t) => t.status !== "revoked")
                    .map((t) => (
                      <li
                        key={t.id}
                        className="rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] p-3"
                      >
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold">{t.name}</p>
                          <span className="shrink-0 text-xs tabular-nums text-[var(--wy-text-muted)]">
                            {tr("list.members", "{{count}} members", { count: t.members })}
                          </span>
                        </div>
                        <p className="mb-2 text-xs text-[var(--wy-text-muted)]">{t.businessUnit}</p>
                        {/* quotaPercent is null when this team has no shared data
                      cap configured (see the fetch effect / createTeam
                      above) -- an unset cap has no "% used" to report, so
                      this shows an honest "No quota set" instead of a bar
                      that would otherwise read as "0% used". */}
                        {t.quotaPercent === null ? (
                          <div className="flex items-center justify-between text-xs text-[var(--wy-text-muted)]">
                            <span>{tr("list.dataQuota", "Data limit")}</span>
                            <span>{tr("list.noQuota", "No limit set")}</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-xs text-[var(--wy-text-muted)]">
                              <span>{tr("list.quotaUsed", "Data used")}</span>
                              <span className="tabular-nums">{t.quotaPercent}%</span>
                            </div>
                            <div
                              role="progressbar"
                              aria-label={tr("list.quotaUsed", "Data used")}
                              aria-valuenow={t.quotaPercent}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--wy-border)]"
                            >
                              <div
                                className="h-full rounded-full bg-[var(--wy-accent)]"
                                style={{ width: `${t.quotaPercent}%` }}
                              />
                            </div>
                          </>
                        )}
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 flex-1 text-xs sm:h-8"
                            onClick={() => openManage(t)}
                          >
                            {tr("list.manage", "Manage")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs text-[var(--wy-crit)] sm:h-8"
                            onClick={() => revokeTeam(t)}
                          >
                            {tr("list.revoke", "Revoke")}
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>
          </div>
        )}

        {tab === "update" && (
          <Panel
            title={tr("find.title", "Find a Guest")}
            description={tr("find.subtitle", "Look up a guest by their mobile number.")}
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* A required-looking "Location *" select used to sit here
                  and feed nothing: the guest search is already scoped to
                  this page's active location, so choosing one changed no
                  result. Removed rather than left as a control that looks
                  load-bearing and is not. */}
                <FormField
                  label={
                    <>
                      {tr("find.mobile", "Mobile No.")}{" "}
                      <span className="text-[var(--wy-crit)]">*</span>
                    </>
                  }
                  htmlFor="find-guest-mobile"
                >
                  <input
                    id="find-guest-mobile"
                    inputMode="numeric"
                    value={udMobile}
                    onChange={(e) => setUdMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder={tr("find.mobilePlaceholder", "Mobile Number")}
                    className={inputCls}
                  />
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button onClick={findUser} disabled={udLoading || !udMobile}>
                  {udLoading ? tr("find.searching", "Searching…") : tr("find.find", "Find Guest")}
                </Button>
              </div>
              {udResult !== null && (
                <div aria-live="polite">
                  {udResult.length === 0 ? (
                    <p className="text-center text-[13px] text-[var(--wy-text-muted)]">
                      {tr("find.noMatch", "No guest matched that number.")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {udResult.map((g) => (
                        <div
                          key={g.id}
                          className="rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-3 py-2.5"
                        >
                          <p className="text-[13px] font-medium">
                            {g.displayName || g.identifier || tr("find.guest", "Guest")}
                          </p>
                          <p className="text-xs text-[var(--wy-text-muted)]">
                            {g.identifier}
                            {g.locationName ? ` · ${g.locationName}` : ""}
                            {g.isBlocked ? ` · ${tr("find.blocked", "blocked")}` : ""}
                          </p>
                        </div>
                      ))}
                      <p className="pt-1 text-xs text-[var(--wy-text-muted)]">
                        {tr(
                          "find.lookupOnly",
                          "Editing guest details isn't available yet — this is a lookup only.",
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>
        )}

        {tab === "bulk-teams" && (
          <Panel
            title={tr("bulkGroups.title", "Add Many Groups at Once")}
            description={tr(
              "bulkGroups.subtitle",
              "Upload a CSV file to create many groups at once.",
            )}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label htmlFor="bulk-groups-location" className={labelCls}>
                    {tr("form.location", "Location")}{" "}
                    <span className="text-[var(--wy-crit)]">*</span>
                  </label>
                  <select
                    id="bulk-groups-location"
                    value={teamsBu}
                    onChange={(e) => setTeamsBu(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{tr("form.chooseLocation", "Choose location")}</option>
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <CsvDropzone file={teamsCsv} onFile={setTeamsCsv} disabled />
                <BulkImportUnavailable />
              </div>
              <QuickNotes
                items={[
                  (
                    <span key="1">
                      {tr("notes.sampleFormat", "Get sample format")}{" "}
                      <button
                        onClick={() =>
                          downloadCsvTemplate(
                            "bulk-teams-template.csv",
                            ["team_name", "business_unit", "shared_users"],
                            ["Sales Team", units[0] ?? "Location", "0"],
                          )
                        }
                        type="button"
                        className="inline-flex items-center gap-1 rounded-sm font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                      >
                        <Download className="h-3 w-3" aria-hidden />
                        {tr("notes.downloadTemplate", "Download Template")}
                      </button>
                    </span>
                  ) as unknown as string,
                  tr("notes.fileSize", "Size of the file should not exceed 30kb (~200 records)."),
                  tr(
                    "notes.zeroUnlimited",
                    "Set the number of guests to 0 to let any number of guests join a group.",
                  ),
                  tr("notes.max5000", "The number of guests should not be more than 5000."),
                ]}
              />
            </div>
          </Panel>
        )}

        {tab === "bulk-map" && (
          <Panel
            title={tr("bulkMap.title", "Add Guests to Groups")}
            description={tr(
              "bulkMap.subtitle",
              "Upload a CSV file to add many guests to groups at once.",
            )}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label htmlFor="bulk-map-location" className={labelCls}>
                    {tr("form.location", "Location")}{" "}
                    <span className="text-[var(--wy-crit)]">*</span>
                  </label>
                  <select
                    id="bulk-map-location"
                    value={mapBu}
                    onChange={(e) => setMapBu(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">{tr("form.chooseLocation", "Choose location")}</option>
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <CsvDropzone file={mapCsv} onFile={setMapCsv} disabled />
                <BulkImportUnavailable />
              </div>
              <QuickNotes
                items={[
                  (
                    <span key="1">
                      {tr("notes.sampleFormat", "Get sample format")}{" "}
                      <button
                        onClick={() =>
                          downloadCsvTemplate(
                            "bulk-map-users-template.csv",
                            ["mobile_number", "team_name", "business_unit"],
                            ["9998887766", "Sales Team", units[0] ?? "Location"],
                          )
                        }
                        type="button"
                        className="inline-flex items-center gap-1 rounded-sm font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                      >
                        <Download className="h-3 w-3" aria-hidden />
                        {tr("notes.downloadTemplate", "Download Template")}
                      </button>
                    </span>
                  ) as unknown as string,
                  tr("notes.fileSize", "Size of the file should not exceed 30kb (~200 records)."),
                ]}
              />
            </div>
          </Panel>
        )}
      </div>

      <Dialog open={!!manageTeam} onOpenChange={(open) => !open && setManageTeam(null)}>
        <DialogContent className="wy-console sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("dialog.title", "Group details")}</DialogTitle>
            <DialogDescription>
              {demo
                ? tr(
                    "dialog.demoDesc",
                    "What this group is set to today. Editing isn't available yet.",
                  )
                : tr(
                    "dialog.desc",
                    "Group name and size are read-only, but you can remove members below.",
                  )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{tr("dialog.groupName", "Group Name")}</label>
              <p className="text-[13px] font-medium">{manageTeam?.name}</p>
            </div>
            <div>
              <label className={labelCls}>{tr("dialog.members", "Members")}</label>
              <p className="text-[13px] font-medium tabular-nums">
                {demo
                  ? (manageTeam?.members ?? 0)
                  : membersState === "loaded"
                    ? members.length
                    : membersState === "loading"
                      ? "…"
                      : "—"}
              </p>
            </div>
            <div>
              <label className={labelCls}>{tr("dialog.sharedUsed", "Shared data used")}</label>
              <p className="text-[13px] font-medium">
                {manageTeam?.quotaPercent == null
                  ? tr("list.noQuota", "No limit set")
                  : tr("dialog.percentOfLimit", "{{percent}}% of the shared limit", {
                      percent: manageTeam.quotaPercent,
                    })}
              </p>
            </div>
            <div>
              <label className={labelCls}>{tr("dialog.status", "Status")}</label>
              <p className="text-[13px] font-medium capitalize">
                {manageTeam ? tr(`status.${manageTeam.status}`, manageTeam.status) : null}
              </p>
            </div>
            {!demo && (
              <div>
                <label className={labelCls}>{tr("dialog.manageMembers", "Manage members")}</label>
                {membersState === "loading" && (
                  <p className="text-[13px] text-[var(--wy-text-muted)]">
                    {tr("dialog.loadingMembers", "Loading members…")}
                  </p>
                )}
                {membersState === "error" && (
                  <p className="text-[13px] text-[var(--wy-text-muted)]">
                    {tr(
                      "dialog.membersError",
                      "Couldn't load this group's members. Close and reopen to try again.",
                    )}
                  </p>
                )}
                {membersState === "loaded" && members.length === 0 && (
                  <p className="text-[13px] text-[var(--wy-text-muted)]">
                    {tr("dialog.noMembers", "No one has joined this group yet.")}
                  </p>
                )}
                {membersState === "loaded" && members.length > 0 && (
                  <ul className="divide-y divide-[var(--wy-border)] rounded-[var(--wy-radius)] border border-[var(--wy-border)]">
                    {members.map((m) => (
                      <li
                        key={m.membershipId}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">
                            {m.displayName ||
                              m.identifier ||
                              tr("dialog.unknownMember", "Unknown member")}
                          </p>
                          <p className="truncate text-xs text-[var(--wy-text-muted)]">
                            {m.displayName && m.identifier ? `${m.identifier} · ` : ""}
                            {tr("dialog.joined", "Joined {{date}}", {
                              date: new Date(m.joinedAt).toLocaleDateString(),
                            })}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={removingGuestId === m.guestId}
                          onClick={() => removeMember(m.guestId)}
                        >
                          {removingGuestId === m.guestId
                            ? tr("dialog.removing", "Removing…")
                            : tr("dialog.remove", "Remove")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-xs text-[var(--wy-text-muted)]">
                  {/* "team code" stays: it is what the guest login page calls
                      the code (portal-i18n.ts teamCodeLabel), and the front
                      desk has to use the guest's word for it. */}
                  {tr(
                    "dialog.removeHint",
                    "Removing a member ends their group membership and any active session. They can rejoin with the team code.",
                  )}
                </p>
              </div>
            )}
            <Callout tone="info">
              <p className="text-xs">
                {tr(
                  "dialog.readOnlyNote",
                  "Renaming a group or changing its size isn't something we can save yet, so we've made this read-only rather than accept a change and lose it. Raise a support ticket and we'll make the change for you.",
                )}
              </p>
            </Callout>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageTeam(null)}>
              {tr("dialog.close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
