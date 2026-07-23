import { useState } from "react";
import { Plus, Users, UserCog, Upload, UploadCloud, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];

interface Team { id: string; name: string; businessUnit: string; members: number; quota: number; status: "active" }

const TABS = [
  { id: "setup", label: "Setup Teams", icon: Users },
  { id: "update", label: "Update User Details", icon: UserCog },
  { id: "bulk-teams", label: "Setup Bulk Teams", icon: Upload },
  { id: "bulk-map", label: "Map Bulk Users", icon: UploadCloud },
] as const;
type TabId = (typeof TABS)[number]["id"];

const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

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

export default function ManageTeamsPage() {
  const [tab, setTab] = useState<TabId>("setup");
  const [teams, setTeams] = useState<Team[]>([
    { id: "1", name: "Sales Team", businessUnit: "Marina Bay Hotel", members: 12, quota: 85, status: "active" },
    { id: "2", name: "Executive VIP", businessUnit: "Downtown CoWork", members: 5, quota: 42, status: "active" },
    { id: "3", name: "Contractors", businessUnit: "Eastside Cafe", members: 8, quota: 100, status: "active" },
  ]);

  // Setup Teams form
  const [bu, setBu] = useState(""); const [teamName, setTeamName] = useState(""); const [sharedUsers, setSharedUsers] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});

  const createTeam = () => {
    const e: Record<string, string> = {};
    if (!bu) e.bu = "Select a business unit.";
    if (!teamName) e.teamName = "Enter a team name.";
    if (sharedUsers === "" || parseInt(sharedUsers) < 0) e.sharedUsers = "Enter shared users count, or 0 for unlimited.";
    setErrs(e); if (Object.keys(e).length) return;

    setTeams((t) => [{ id: String(Date.now()), name: teamName, businessUnit: bu, members: 0, quota: 0, status: "active" }, ...t]);
    setTeamName(""); setSharedUsers("");
    toast.success("Team created");
  };

  // Update User Details form
  const [udBu, setUdBu] = useState(""); const [udMobile, setUdMobile] = useState("");

  // Bulk forms
  const [teamsBu, setTeamsBu] = useState(""); const [teamsCsv, setTeamsCsv] = useState<File | null>(null);
  const [mapBu, setMapBu] = useState(""); const [mapCsv, setMapCsv] = useState<File | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Users className="h-6 w-6 text-primary" /> Manage Teams</h1>
        <p className="mt-1 text-sm text-muted-foreground">Group guests into teams with shared data quotas and manage them in bulk.</p>
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
        <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold text-foreground">Setup Teams</h2>
          <p className="mb-5 text-sm text-muted-foreground">Please use this to set up your teams.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
              <select value={bu} onChange={(e) => { setBu(e.target.value); setErrs((p) => ({ ...p, bu: "" })); }} className={inputCls}><option value="">Choose business unit</option>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
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

          <hr className="my-6 border-border" />
          <h3 className="mb-3 text-sm font-semibold text-foreground">Current Teams</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => (
              <Card key={t.id} className="border shadow-none">
                <CardContent className="p-4">
                  <div className="mb-1 flex items-center justify-between"><p className="text-sm font-semibold">{t.name}</p><Badge variant="outline">{t.members} members</Badge></div>
                  <p className="mb-2 text-xs text-muted-foreground">{t.businessUnit}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Quota used</span><span>{t.quota}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${t.quota}%` }} /></div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => toast.success(`${t.name} updated`)}>Manage</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => { setTeams((p) => p.filter((x) => x.id !== t.id)); toast.success("Team revoked"); }}>Revoke</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "update" && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold text-foreground">Update User Details</h2>
          <p className="mb-5 text-sm text-muted-foreground">Please use this to modify user details.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
              <select value={udBu} onChange={(e) => setUdBu(e.target.value)} className={inputCls}><option value="">Choose business unit</option>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
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
        </div>
      )}

      {tab === "bulk-teams" && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold text-foreground">Setup Bulk Teams</h2>
          <p className="mb-5 text-sm text-muted-foreground">Please upload your CSV file here to create teams in bulk.</p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
                <select value={teamsBu} onChange={(e) => setTeamsBu(e.target.value)} className={inputCls}><option value="">Choose business unit</option>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
              </div>
              <CsvDropzone file={teamsCsv} onFile={setTeamsCsv} />
              <div className="flex justify-center">
                <Button disabled={!teamsBu || !teamsCsv} onClick={() => { toast.success(`Uploaded ${teamsCsv?.name} — teams queued for import.`); setTeamsCsv(null); }}><Upload className="mr-2 h-4 w-4" />Upload &amp; Create</Button>
              </div>
            </div>
            <QuickNotes items={[
              <span key="1">Get sample format <button onClick={() => toast.success("Template downloaded")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Download className="h-3 w-3" />Download Template</button></span> as unknown as string,
              "Size of the file should not exceed 30kb (~200 records).",
              "You can set shared users to 0 for unlimited user access for any team.",
              "Shared users should not be more than 5000.",
            ]} />
          </div>
        </div>
      )}

      {tab === "bulk-map" && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold text-foreground">Map Bulk Users</h2>
          <p className="mb-5 text-sm text-muted-foreground">Please upload your CSV file here to map users to teams in bulk.</p>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
                <select value={mapBu} onChange={(e) => setMapBu(e.target.value)} className={inputCls}><option value="">Choose business unit</option>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
              </div>
              <CsvDropzone file={mapCsv} onFile={setMapCsv} />
              <div className="flex justify-center">
                <Button disabled={!mapBu || !mapCsv} onClick={() => { toast.success(`Uploaded ${mapCsv?.name} — user mapping queued.`); setMapCsv(null); }}><Upload className="mr-2 h-4 w-4" />Upload &amp; Map</Button>
              </div>
            </div>
            <QuickNotes items={[
              <span key="1">Get sample format <button onClick={() => toast.success("Template downloaded")} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Download className="h-3 w-3" />Download Template</button></span> as unknown as string,
              "Size of the file should not exceed 30kb (~200 records).",
            ]} />
          </div>
        </div>
      )}
    </div>
  );
}
