import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Users, UserPlus, UserCog, Upload, UploadCloud, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { useIsDemo, useCustomerLocations } from "@/hooks/useCustomerDashboard";
import { guestService } from "@/services/guest.service";
import { resolveOrgId } from "@/services/customer.service";

const UNITS = ["Mumbai HQ", "Delhi Office", "Bangalore DC", "Chennai Office"]; // Matches this demo account's real location roster (see customer.service.ts DEMO_LOCATIONS) instead of unrelated placeholder hospitality names that clashed with the rest of the demo persona.

interface Team { id: string; name: string; businessUnit: string; members: number; quota: number; status: "active" | "expired" | "revoked" }

const DEMO_TEAMS: Team[] = [
  { id: "1", name: "Sales Team", businessUnit: "Mumbai HQ", members: 12, quota: 85, status: "active" },
  { id: "2", name: "Executive VIP", businessUnit: "Delhi Office", members: 5, quota: 42, status: "active" },
  { id: "3", name: "Contractors", businessUnit: "Bangalore DC", members: 8, quota: 100, status: "active" },
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

const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
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

function CsvDropzone({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40">
      <input type="file" accept=".csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
      {file ? (
        <p className="text-sm font-medium text-foreground">{file.name}</p>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">Click to upload a CSV file</p>
          <p className="text-xs text-muted-foreground">or drag and drop it here</p>
        </>
      )}
    </label>
  );
}

function QuickNotes({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Notes</p>
      <ol className="space-y-1 text-xs text-muted-foreground">
        {items.map((n, i) => <li key={i}>{i + 1}. {n}</li>)}
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
    <svg aria-hidden="true" viewBox="0 0 88 44" className="hidden h-12 w-auto shrink-0 sm:block" fill="none">
      <motion.path
        d="M18 16Q32 26 42 12Q54 -2 70 18"
        stroke="#4f46e5" strokeOpacity="0.4" strokeWidth="1.3" strokeDasharray="1 4" strokeLinecap="round" fill="none"
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
          <circle cx={c.cx - 4} cy={c.cy + 2} r="6" fill="#2e2a5c" stroke={c.color} strokeWidth="1.4" />
          <circle cx={c.cx + 5} cy={c.cy - 2} r="6" fill="#2e2a5c" stroke={c.color} strokeWidth="1.4" />
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
  // has their own locations, so every "Business Unit" picker below must
  // offer those instead. Same real-vs-demo split as WhiteList.tsx's
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
        setTeams(rows.map((t) => ({ id: t.id, name: t.name, businessUnit: "", members: t.maxMembers ?? 0, quota: 0, status: t.status })));
      } catch {
        // Leave teams empty -- the "no teams yet" state is accurate.
      }
    })();
  }, [demo, locationId]);

  // Setup Teams form
  const [bu, setBu] = useState(""); const [teamName, setTeamName] = useState(""); const [sharedUsers, setSharedUsers] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});

  // Manage Team dialog
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  const [manageDraft, setManageDraft] = useState({ name: "", businessUnit: "", members: "" });

  const openManage = (t: Team) => {
    setManageTeam(t);
    setManageDraft({ name: t.name, businessUnit: t.businessUnit, members: String(t.members) });
  };

  const saveManage = () => {
    if (!manageTeam) return;
    if (!manageDraft.name.trim()) { toast.error("Enter a team name."); return; }
    const members = Math.max(0, parseInt(manageDraft.members) || 0);
    setTeams((p) => p.map((t) => t.id === manageTeam.id ? { ...t, name: manageDraft.name.trim(), businessUnit: manageDraft.businessUnit, members } : t));
    toast.success(`${manageDraft.name} updated`);
    setManageTeam(null);
  };

  const createTeam = async () => {
    const e: Record<string, string> = {};
    if (demo && !bu) e.bu = "Select a business unit.";
    if (!teamName) e.teamName = "Enter a team name.";
    if (sharedUsers === "" || parseInt(sharedUsers) < 0) e.sharedUsers = "Enter shared users count, or 0 for unlimited.";
    setErrs(e); if (Object.keys(e).length) return;

    if (demo) {
      setTeams((t) => [{ id: String(Date.now()), name: teamName, businessUnit: bu, members: 0, quota: 0, status: "active" }, ...t]);
      setTeamName(""); setSharedUsers("");
      toast.success("Team created");
      return;
    }
    if (!orgId) { toast.error("No organization found for this session."); return; }
    try {
      const max = parseInt(sharedUsers) || 0;
      const created = await guestService.createTeam({ organizationId: orgId, locationId: locationId ?? undefined, name: teamName, maxMembers: max > 0 ? max : undefined });
      setTeams((t) => [{ id: created.id, name: created.name, businessUnit: "", members: created.maxMembers ?? 0, quota: 0, status: "active" }, ...t]);
      setTeamName(""); setSharedUsers("");
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
      try { await guestService.revokeTeam(t.id, undefined, orgId ?? undefined); }
      catch { setTeams(prev); toast.error("Could not revoke on the server."); }
    }
  };

  // Update User Details form
  const [udBu, setUdBu] = useState(""); const [udMobile, setUdMobile] = useState("");

  // Bulk forms
  const [teamsBu, setTeamsBu] = useState(""); const [teamsCsv, setTeamsCsv] = useState<File | null>(null);
  const [mapBu, setMapBu] = useState(""); const [mapCsv, setMapCsv] = useState<File | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Users className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Guest Groups</h1>
            <p className="text-sm text-muted-foreground">Group guests into teams with shared data quotas and manage them in bulk.</p>
          </div>
        </div>
        <TeamClustersIllustration />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-muted/40 p-1">
        <div className="flex min-w-[560px] gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", tab === t.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <t.icon className="h-4 w-4" />{t.label}
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
                  <p className="text-sm text-muted-foreground">Create a shared team or desk account with its own member limit.</p>
                </div>
              </div>
              <div className="grid gap-4 rounded-xl bg-muted/40 p-5 md:grid-cols-3">
                <div>
                  <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
                  <select value={bu} onChange={(e) => { setBu(e.target.value); setErrs((p) => ({ ...p, bu: "" })); }} className={inputCls}><option value="">Choose business unit</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                  {errs.bu && <p className="mt-1 text-xs text-destructive">{errs.bu}</p>}
                </div>
                <div>
                  <label className={labelCls}>Team Name <span className="text-destructive">*</span></label>
                  <input value={teamName} onChange={(e) => { setTeamName(e.target.value); setErrs((p) => ({ ...p, teamName: "" })); }} placeholder="Please enter team name" className={inputCls} />
                  {errs.teamName && <p className="mt-1 text-xs text-destructive">{errs.teamName}</p>}
                </div>
                <div>
                  <label className={labelCls}>Shared Users <span className="text-destructive">*</span></label>
                  <input type="number" min={0} value={sharedUsers} onChange={(e) => { setSharedUsers(e.target.value); setErrs((p) => ({ ...p, sharedUsers: "" })); }} placeholder="Enter shared users count or set 0 for unlimited" className={inputCls} />
                  {errs.sharedUsers && <p className="mt-1 text-xs text-destructive">{errs.sharedUsers}</p>}
                </div>
              </div>
              <div className="mt-5 flex justify-center"><Button onClick={createTeam}><Plus className="mr-2 h-4 w-4" />Create Team</Button></div>
            </CardContent>
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Your Teams</h3>
              {teams.filter((t) => t.status !== "revoked").length > 0 && (
                <Badge variant="outline">{teams.filter((t) => t.status !== "revoked").length} total</Badge>
              )}
            </div>
            {teams.filter((t) => t.status !== "revoked").length === 0 ? (
              <EmptyState icon={Users} title="No team accounts yet" description="Create one above to get started." />
            ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teams.filter((t) => t.status !== "revoked").map((t) => (
                <Card key={t.id} className="border-0 bg-muted/40 shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-1 flex items-center justify-between"><p className="text-sm font-semibold">{t.name}</p><Badge variant="outline">{t.members} members</Badge></div>
                    <p className="mb-2 text-xs text-muted-foreground">{t.businessUnit}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Quota used</span><span>{t.quota}%</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${t.quota}%` }} /></div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => openManage(t)}>Manage</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => revokeTeam(t)}>Revoke</Button>
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
        <Card className="border-0 shadow-sm"><CardContent className="p-6 md:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Update User Details</h2>
          <p className="mb-5 text-sm text-muted-foreground">Please use this to modify user details.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
              <select value={udBu} onChange={(e) => setUdBu(e.target.value)} className={inputCls}><option value="">Choose business unit</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </div>
            <div>
              <label className={labelCls}>Mobile No. <span className="text-destructive">*</span></label>
              <input value={udMobile} onChange={(e) => setUdMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Mobile Number" className={inputCls} />
            </div>
          </div>
          <div className="mt-5 flex justify-center">
            <Button onClick={() => { if (!udBu || !udMobile) { toast.error("Fill in business unit and mobile number."); return; } toast.success("Looked up user — no changes yet."); }}>
              Find User
            </Button>
          </div>
        </CardContent></Card>
      )}

      {tab === "bulk-teams" && (
        <Card className="border-0 shadow-sm"><CardContent className="p-6 md:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Setup Bulk Teams</h2>
          <p className="mb-5 text-sm text-muted-foreground">Please upload your CSV file here to create teams in bulk.</p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
                <select value={teamsBu} onChange={(e) => setTeamsBu(e.target.value)} className={inputCls}><option value="">Choose business unit</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
              </div>
              <CsvDropzone file={teamsCsv} onFile={setTeamsCsv} />
              <div className="flex justify-center">
                <Button disabled={!teamsBu || !teamsCsv} onClick={() => { toast.success(`Uploaded ${teamsCsv?.name} — teams queued for import.`); setTeamsCsv(null); }}><Upload className="mr-2 h-4 w-4" />Upload &amp; Create</Button>
              </div>
            </div>
            <QuickNotes items={[
              <span key="1">Get sample format <button onClick={() => downloadCsvTemplate("bulk-teams-template.csv", ["team_name", "business_unit", "shared_users"], ["Sales Team", units[0] ?? "Business Unit", "0"])} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Download className="h-3 w-3" />Download Template</button></span> as unknown as string,
              "Size of the file should not exceed 30kb (~200 records).",
              "You can set shared users to 0 for unlimited user access for any team.",
              "Shared users should not be more than 5000.",
            ]} />
          </div>
        </CardContent></Card>
      )}

      {tab === "bulk-map" && (
        <Card className="border-0 shadow-sm"><CardContent className="p-6 md:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Map Bulk Users</h2>
          <p className="mb-5 text-sm text-muted-foreground">Please upload your CSV file here to map users to teams in bulk.</p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
                <select value={mapBu} onChange={(e) => setMapBu(e.target.value)} className={inputCls}><option value="">Choose business unit</option>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
              </div>
              <CsvDropzone file={mapCsv} onFile={setMapCsv} />
              <div className="flex justify-center">
                <Button disabled={!mapBu || !mapCsv} onClick={() => { toast.success(`Uploaded ${mapCsv?.name} — user mapping queued.`); setMapCsv(null); }}><Upload className="mr-2 h-4 w-4" />Upload &amp; Map</Button>
              </div>
            </div>
            <QuickNotes items={[
              <span key="1">Get sample format <button onClick={() => downloadCsvTemplate("bulk-map-users-template.csv", ["mobile_number", "team_name", "business_unit"], ["9998887766", "Sales Team", units[0] ?? "Business Unit"])} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Download className="h-3 w-3" />Download Template</button></span> as unknown as string,
              "Size of the file should not exceed 30kb (~200 records).",
            ]} />
          </div>
        </CardContent></Card>
      )}

      <Dialog open={!!manageTeam} onOpenChange={(open) => !open && setManageTeam(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Team</DialogTitle>
            <DialogDescription>Update this team's name, business unit, or member count.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Team Name</label>
              <input value={manageDraft.name} onChange={(e) => setManageDraft((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Business Unit</label>
              <select value={manageDraft.businessUnit} onChange={(e) => setManageDraft((p) => ({ ...p, businessUnit: e.target.value }))} className={inputCls}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Members</label>
              <input type="number" min={0} value={manageDraft.members} onChange={(e) => setManageDraft((p) => ({ ...p, members: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageTeam(null)}>Cancel</Button>
            <Button onClick={saveManage}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
