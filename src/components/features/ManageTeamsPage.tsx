import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Users,
  UserPlus,
  UserCog,
  Upload,
  UploadCloud,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { guestService } from "@/services/guest.service";
import type { Guest } from "@/types/guest";
import { resolveOrgId } from "@/services/customer.service";

const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.

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
  { id: "setup", label: "Team Accounts", icon: Users },
  { id: "update", label: "Update User Details", icon: UserCog },
  { id: "bulk-teams", label: "Setup Bulk Teams", icon: Upload },
  { id: "bulk-map", label: "Map Bulk Users", icon: UploadCloud },
] as const;
type TabId = (typeof TABS)[number]["id"];

const inputCls =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

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
  toast.success("Template downloaded");
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
  return (
    <label
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-primary/50 hover:bg-accent/40",
      )}
    >
      <input
        type="file"
        accept=".csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
      {file ? (
        <p className="text-sm font-medium text-foreground">{file.name}</p>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">
            {disabled ? "CSV import isn't available yet" : "Click to upload a CSV file"}
          </p>
          <p className="text-xs text-muted-foreground">
            {disabled ? "See below" : "or drag and drop it here"}
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
  return (
    <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-center">
      <p className="text-sm font-medium text-foreground">Bulk import is coming</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        We haven&apos;t shipped spreadsheet import yet, so we&apos;ve switched this off rather than
        take a file and quietly drop it. Add groups with{" "}
        <span className="font-medium text-foreground">Create Team</span> above, or send us your
        sheet on a support ticket and we&apos;ll load it for you.
      </p>
    </div>
  );
}

function QuickNotes({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quick Notes
      </p>
      <ol className="space-y-1 text-xs text-muted-foreground">
        {items.map((n, i) => (
          <li key={i}>
            {i + 1}. {n}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Small header-accent illustration: three separate user clusters (teams),
 * each a pair of nodes, connected loosely into one grouping -- what this
 * page actually does (grouping guests into teams with shared quotas).
 * Same filled-flat-shape character language as the other illustrations
 * shipped this session. Purely decorative -- aria-hidden.
 */
function TeamClustersIllustration() {
  const shouldReduceMotion = useReducedMotion();
  const clusters = [
    { cx: 14, cy: 14, color: "#22d3ee" },
    { cx: 44, cy: 8, color: "#f0abfc" },
    { cx: 72, cy: 20, color: "#a78bfa" },
  ];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 88 44"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <motion.path
        d="M18 16Q32 26 42 12Q54 -2 70 18"
        stroke="#4f46e5"
        strokeOpacity="0.4"
        strokeWidth="1.3"
        strokeDasharray="1 4"
        strokeLinecap="round"
        fill="none"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      {clusters.map((c, i) => (
        <motion.g
          key={i}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 * i, ease: "easeOut" }}
        >
          <circle
            cx={c.cx - 4}
            cy={c.cy + 2}
            r="6"
            fill="#2e2a5c"
            stroke={c.color}
            strokeWidth="1.4"
          />
          <circle
            cx={c.cx + 5}
            cy={c.cy - 2}
            r="6"
            fill="#2e2a5c"
            stroke={c.color}
            strokeWidth="1.4"
          />
          <circle cx={c.cx - 4} cy={c.cy} r="1.7" fill={c.color} />
          <circle cx={c.cx + 5} cy={c.cy - 4} r="1.7" fill={c.color} />
        </motion.g>
      ))}
    </svg>
  );
}

export default function ManageTeamsPage({ locationId }: { locationId?: string } = {}) {
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
  const openManage = (t: Team) => setManageTeam(t);

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
    if (demo && !bu) e.bu = "Select a location.";
    if (!teamName) e.teamName = "Enter a team name.";
    if (sharedUsers === "" || parseInt(sharedUsers) < 0)
      e.sharedUsers = "Enter shared users count, or 0 for unlimited.";
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
      toast.success("Team created");
      return;
    }
    if (!orgId) {
      toast.error("No organization found for this session.");
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
      toast.success("Team created");
    } catch {
      toast.error("Could not create the team — check the connection and try again.");
    }
  };

  const revokeTeam = async (t: Team) => {
    const prev = teams;
    setTeams((p) => p.filter((x) => x.id !== t.id));
    toast.success("Team revoked");
    if (!demo) {
      try {
        await guestService.revokeTeam(t.id, undefined, orgId ?? undefined);
      } catch {
        setTeams(prev);
        toast.error("Could not revoke on the server.");
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
      toast.error("Enter a mobile number.");
      return;
    }
    if (demo) {
      toast.error("Guest lookup needs a real account.");
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
      if (res.rows.length === 0) toast.info("No guest matched that number.");
    } catch {
      toast.error("Could not search for that guest.");
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Users className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Guest Groups</h1>
            <p className="text-sm text-muted-foreground">
              Group guests into teams with shared data quotas and manage them in bulk.
            </p>
          </div>
        </div>
        <TeamClustersIllustration />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-muted/40 p-1">
        <div className="flex min-w-[560px] gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "setup" && (
        <div className="space-y-6">
          {/* Was one Card with an <hr> splitting the form from the list --
              split into two sections (own-icon header on the form, a
              count badge on the list) so it reads like OpenHoursView's
              schedule-card + guest-experience-card composition instead of
              a single generic form-then-table block. */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="mb-5 flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
                  <UserPlus className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Team Accounts</h2>
                  <p className="text-sm text-muted-foreground">
                    Create a shared team or desk account with its own member limit.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 rounded-xl bg-muted/40 p-5 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={labelCls}>
                    Location <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={bu}
                    onChange={(e) => {
                      setBu(e.target.value);
                      setErrs((p) => ({ ...p, bu: "" }));
                    }}
                    className={inputCls}
                  >
                    <option value="">Choose location</option>
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  {errs.bu && <p className="mt-1 text-xs text-destructive">{errs.bu}</p>}
                </div>
                <div>
                  <label className={labelCls}>
                    Team Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value);
                      setErrs((p) => ({ ...p, teamName: "" }));
                    }}
                    placeholder="Please enter team name"
                    className={inputCls}
                  />
                  {errs.teamName && (
                    <p className="mt-1 text-xs text-destructive">{errs.teamName}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>
                    Shared Users <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={sharedUsers}
                    onChange={(e) => {
                      setSharedUsers(e.target.value);
                      setErrs((p) => ({ ...p, sharedUsers: "" }));
                    }}
                    placeholder="Enter shared users count or set 0 for unlimited"
                    className={inputCls}
                  />
                  {errs.sharedUsers && (
                    <p className="mt-1 text-xs text-destructive">{errs.sharedUsers}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Shared Data Quota (MB)</label>
                  <input
                    type="number"
                    min={0}
                    value={sharedQuotaMb}
                    onChange={(e) => setSharedQuotaMb(e.target.value)}
                    placeholder="Leave blank or 0 for unlimited"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-center">
                <Button onClick={createTeam}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Your Teams</h3>
              {teams.filter((t) => t.status !== "revoked").length > 0 && (
                <Badge variant="outline">
                  {teams.filter((t) => t.status !== "revoked").length} total
                </Badge>
              )}
            </div>
            {teams.filter((t) => t.status !== "revoked").length === 0 ? (
              <EmptyState
                icon={Users}
                title="No team accounts yet"
                description="Create one above to get started."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teams
                  .filter((t) => t.status !== "revoked")
                  .map((t) => (
                    <Card key={t.id} className="border-0 bg-muted/40 shadow-sm">
                      <CardContent className="p-4">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-sm font-semibold">{t.name}</p>
                          <Badge variant="outline">{t.members} members</Badge>
                        </div>
                        <p className="mb-2 text-xs text-muted-foreground">{t.businessUnit}</p>
                        {/* quotaPercent is null when this team has no shared data
                        cap configured (see the fetch effect / createTeam
                        above) -- an unset cap has no "% used" to report, so
                        this shows an honest "No quota set" instead of a bar
                        that would otherwise read as "0% used". */}
                        {t.quotaPercent === null ? (
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Data quota</span>
                            <span>No quota set</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Quota used</span>
                              <span>{t.quotaPercent}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${t.quotaPercent}%` }}
                              />
                            </div>
                          </>
                        )}
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 flex-1 text-xs"
                            onClick={() => openManage(t)}
                          >
                            Manage
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-destructive"
                            onClick={() => revokeTeam(t)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "update" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-lg font-semibold tracking-tight">Update User Details</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Please use this to modify user details.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {/* A required-looking "Location *" select used to sit here
                  and feed nothing: the guest search is already scoped to
                  this page's active location, so choosing one changed no
                  result. Removed rather than left as a control that looks
                  load-bearing and is not. */}
              <div>
                <label className={labelCls}>
                  Mobile No. <span className="text-destructive">*</span>
                </label>
                <input
                  value={udMobile}
                  onChange={(e) => setUdMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="Mobile Number"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-center">
              <Button onClick={findUser} disabled={udLoading || !udMobile}>
                {udLoading ? "Searching…" : "Find User"}
              </Button>
            </div>
            {udResult !== null && (
              <div className="mt-5">
                {udResult.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    No guest matched that number.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {udResult.map((g) => (
                      <div key={g.id} className="rounded-xl bg-muted/40 px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {g.displayName || g.identifier || "Guest"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {g.identifier}
                          {g.locationName ? ` · ${g.locationName}` : ""}
                          {g.isBlocked ? " · blocked" : ""}
                        </p>
                      </div>
                    ))}
                    <p className="pt-1 text-center text-xs text-muted-foreground">
                      Editing guest details isn&apos;t available yet — this is a lookup only.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "bulk-teams" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-lg font-semibold tracking-tight">Setup Bulk Teams</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Please upload your CSV file here to create teams in bulk.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>
                    Location <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={teamsBu}
                    onChange={(e) => setTeamsBu(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Choose location</option>
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
                      Get sample format{" "}
                      <button
                        onClick={() =>
                          downloadCsvTemplate(
                            "bulk-teams-template.csv",
                            ["team_name", "business_unit", "shared_users"],
                            ["Sales Team", units[0] ?? "Location", "0"],
                          )
                        }
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Download Template
                      </button>
                    </span>
                  ) as unknown as string,
                  "Size of the file should not exceed 30kb (~200 records).",
                  "You can set shared users to 0 for unlimited user access for any team.",
                  "Shared users should not be more than 5000.",
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "bulk-map" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 md:p-8">
            <h2 className="text-lg font-semibold tracking-tight">Map Bulk Users</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Please upload your CSV file here to map users to teams in bulk.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>
                    Location <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={mapBu}
                    onChange={(e) => setMapBu(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Choose location</option>
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
                      Get sample format{" "}
                      <button
                        onClick={() =>
                          downloadCsvTemplate(
                            "bulk-map-users-template.csv",
                            ["mobile_number", "team_name", "business_unit"],
                            ["9998887766", "Sales Team", units[0] ?? "Location"],
                          )
                        }
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Download Template
                      </button>
                    </span>
                  ) as unknown as string,
                  "Size of the file should not exceed 30kb (~200 records).",
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!manageTeam} onOpenChange={(open) => !open && setManageTeam(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Team details</DialogTitle>
            <DialogDescription>
              What this team is set to today. Editing isn&apos;t available yet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Team Name</label>
              <p className="text-sm font-medium text-foreground">{manageTeam?.name}</p>
            </div>
            <div>
              <label className={labelCls}>Members</label>
              <p className="text-sm font-medium text-foreground">{manageTeam?.members ?? 0}</p>
            </div>
            <div>
              <label className={labelCls}>Shared data used</label>
              <p className="text-sm font-medium text-foreground">
                {manageTeam?.quotaPercent == null
                  ? "No quota set"
                  : `${manageTeam.quotaPercent}% of the shared limit`}
              </p>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <p className="text-sm font-medium capitalize text-foreground">{manageTeam?.status}</p>
            </div>
            <div className="rounded-xl border border-dashed bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Renaming a team or changing its size isn&apos;t something we can save yet, so
                we&apos;ve made this read-only rather than accept a change and lose it. Raise a
                support ticket and we&apos;ll make the change for you.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageTeam(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
