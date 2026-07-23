import { useEffect, useState } from "react";
import { Plus, Trash2, Play, Pause, Copy, Search, ClipboardList, Image as ImageIcon, Link2, Star, MessageSquareText, Percent, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { isDemo } from "@/services/customer.service";
import { campaignService } from "@/services/campaign.service";
import type { CampaignType } from "@/types/campaign";

interface Campaign { id: string; name: string; type: string; status: string; businessUnit: string; startDate: string; endDate: string; impressions: number; conversions: number; }
const TYPES = ["SURVEY", "BANNER", "REDIRECT"];
const STATUSES = ["draft", "scheduled", "active", "paused", "ended"];
const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];

const SURVEY_QUESTIONS = [
  { q: "Rate our food quality?", options: ["Excellent", "Good", "Average", "Could be better"] },
  { q: "Rate courteousness of our staff?", options: ["Very Good", "Average", "Could be better", "Poor"] },
  { q: "How do you rate our cleanliness?", options: ["Excellent", "Good", "Average", "Could be better"] },
];

const DEMO_SEED: Campaign[] = [
  { id: "1", name: "Summer Promo", type: "BANNER", status: "active", businessUnit: "Marina Bay Hotel", startDate: "2026-06-01", endDate: "2026-08-31", impressions: 2841, conversions: 423 },
  { id: "2", name: "Guest Feedback", type: "SURVEY", status: "draft", businessUnit: "Downtown CoWork", startDate: "2026-07-01", endDate: "2026-09-30", impressions: 0, conversions: 0 },
  { id: "3", name: "Weekend Special", type: "REDIRECT", status: "paused", businessUnit: "Eastside Cafe", startDate: "2026-05-15", endDate: "2026-07-15", impressions: 1520, conversions: 198 },
];

const emptyForm = { name: "", type: "SURVEY", businessUnit: "", startDate: "", endDate: "" };
const emptyFilters = { businessUnit: "", type: "", startDate: "" };

export function CampaignsPage({ locationId }: { locationId?: string }) {
  const demo = isDemo();
  const [items, setItems] = useState<Campaign[]>(demo ? DEMO_SEED : []);
  const [loading, setLoading] = useState(!demo);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState(emptyFilters);
  const [showSearch, setShowSearch] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("https://zipwifi.io/welcome");

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    setLoading(true);
    campaignService.list({ locationId, page: 1, pageSize: 50 })
      .then((res) => {
        if (cancelled) return;
        setItems(res.rows.map((c) => ({
          id: c.id, name: c.name, type: c.campaignType.toUpperCase(), status: c.status,
          businessUnit: "", startDate: c.startsAt?.slice(0, 10) ?? "", endDate: c.endsAt?.slice(0, 10) ?? "",
          impressions: 0, conversions: 0,
        })));
      })
      .catch(() => { if (!cancelled) setItems(DEMO_SEED); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [demo, locationId]);

  const openCreate = (type: string) => { setForm({ ...emptyForm, type }); setErrs({}); setShowCreate(true); };

  const handleCreate = async () => {
    const e: Record<string, string> = {};
    if (!form.name) e.name = "Campaign name is required.";
    if (!form.startDate) e.startDate = "Required.";
    if (!form.endDate) e.endDate = "Required.";
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = "End date must be after start date.";
    if (demo && !form.businessUnit) e.businessUnit = "Select a business unit.";
    setErrs(e); if (Object.keys(e).length) return;

    if (demo) {
      setItems([{ id: String(Date.now()), name: form.name, type: form.type, status: "draft", businessUnit: form.businessUnit, startDate: form.startDate, endDate: form.endDate, impressions: 0, conversions: 0 }, ...items]);
      setForm(emptyForm);
      setShowCreate(false);
      toast.success("Campaign created");
      return;
    }

    try {
      const created = await campaignService.create({
        locationId, name: form.name, campaignType: form.type.toLowerCase() as CampaignType,
        startsAt: form.startDate ? new Date(form.startDate).toISOString() : null,
        endsAt: form.endDate ? new Date(form.endDate).toISOString() : null,
      });
      setItems([{ id: created.id, name: created.name, type: created.campaignType.toUpperCase(), status: created.status, businessUnit: "", startDate: form.startDate, endDate: form.endDate, impressions: 0, conversions: 0 }, ...items]);
      setForm(emptyForm);
      setShowCreate(false);
      toast.success("Campaign created");
    } catch {
      toast.error("Could not create the campaign — check the connection and try again.");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const prev = items;
    setItems(items.map(i => i.id === id ? { ...i, status } : i));
    if (demo) { toast.success(`Campaign ${status}`); return; }
    try {
      if (status === "paused") await campaignService.pause(id);
      else if (status === "active") await campaignService.resume(id);
      else if (status === "scheduled") await campaignService.schedule(id);
      else if (status === "ended") await campaignService.end(id);
      toast.success(`Campaign ${status}`);
    } catch {
      setItems(prev);
      toast.error("Could not update the campaign on the server.");
    }
  };

  const removeCampaign = async (id: string) => {
    const prev = items;
    setItems(items.filter(i => i.id !== id));
    toast.success("Campaign deleted");
    if (!demo) {
      try { await campaignService.remove(id); }
      catch { setItems(prev); toast.error("Could not delete on the server."); }
    }
  };

  const filtered = items.filter((c) =>
    (!filters.businessUnit || c.businessUnit === filters.businessUnit) &&
    (!filters.type || c.type === filters.type) &&
    (!filters.startDate || c.startDate >= filters.startDate)
  );
  const filtersActive = filters.businessUnit || filters.type || filters.startDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Campaign</h2><p className="text-sm text-muted-foreground">Reach, survey, and re-engage guests over your WiFi.</p></div>
        <div className="relative flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSearch((v) => !v)}><Search className="mr-2 h-4 w-4" />Search Campaign{filtersActive && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}</Button>
          <Button onClick={() => openCreate("SURVEY")}><Plus className="mr-2 h-4 w-4" />Create Campaign</Button>

          {showSearch && (
            <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border bg-card p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-sm font-semibold">Search Campaign</p><p className="text-xs text-muted-foreground">Search, edit, activate or deactivate any campaign for any Business Unit.</p></div>
                <button onClick={() => setShowSearch(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div><Label className="text-xs">Business Unit</Label><Select value={filters.businessUnit || "__all"} onValueChange={(v) => setFilters((f) => ({ ...f, businessUnit: v === "__all" ? "" : v }))}><SelectTrigger className="h-9"><SelectValue placeholder="All business units" /></SelectTrigger><SelectContent><SelectItem value="__all">All business units</SelectItem>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Campaign Type</Label><Select value={filters.type || "__all"} onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "__all" ? "" : v }))}><SelectTrigger className="h-9"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent><SelectItem value="__all">All types</SelectItem>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Campaign Start Date</Label><Input type="date" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} className="h-9" /></div>
              </div>
              <div className="mt-4 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setFilters(emptyFilters)}>Clear</Button><Button size="sm" onClick={() => setShowSearch(false)}>Apply</Button></div>
            </div>
          )}
        </div>
      </div>

      {/* Types of Campaign */}
      <div>
        <div className="mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="text-base font-semibold">Types of Campaign</h3></div>
        <p className="mb-4 text-sm text-muted-foreground">Leverage WiFi as a communication platform. Run different types of campaigns &amp; promote your intentions internally &amp; externally.</p>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Survey & Feedback */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageSquareText className="h-4.5 w-4.5" /></span>
              <CardTitle className="text-sm">Survey &amp; Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                {SURVEY_QUESTIONS.map((s, i) => (
                  <div key={s.q} className={i > 0 ? "border-t pt-3" : ""}>
                    <p className="mb-2 text-xs font-medium">{i + 1}. {s.q}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.options.map((o) => (
                        <span key={o} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"><Star className="h-3 w-3 text-amber-400" />{o}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold">Feedback Made Easy</p>
                <p className="text-xs text-muted-foreground">Collect real-time feedback from your users to improve your business &amp; user satisfaction.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openCreate("SURVEY")}><ClipboardList className="mr-2 h-4 w-4" />Create Survey Campaign</Button>
            </CardContent>
          </Card>

          {/* Banner & Discounts */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImageIcon className="h-4.5 w-4.5" /></span>
              <CardTitle className="text-sm">Banner &amp; Discounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-primary/15 to-primary/5">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <Badge className="mb-2 gap-1" variant="secondary"><Percent className="h-3 w-3" />fb campaign</Badge>
                    <p className="text-sm font-semibold">Flat 20% off this weekend</p>
                    <p className="text-xs text-muted-foreground">Show this coupon at checkout</p>
                  </div>
                  <div className="rounded-lg border bg-card px-3 py-2 text-center"><p className="font-mono text-sm font-bold text-primary">SAVE20</p></div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">More Business With Discounts</p>
                <p className="text-xs text-muted-foreground">Pull more business from your users leveraging discount coupons delivered to their Mobile Phones.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openCreate("BANNER")}><ImageIcon className="mr-2 h-4 w-4" />Create Banner Campaign</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Post-Login Redirect URL */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-4.5 w-4.5" /></span>
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Post-Login Redirect URL</Label>
            <p className="mb-1.5 text-xs text-muted-foreground">Where guests land right after they connect.</p>
            <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} className="h-9" />
          </div>
          <Button size="sm" onClick={() => toast.success("Redirect URL saved")}>Save</Button>
        </CardContent>
      </Card>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold">Create Campaign</h3>
            <p className="mb-4 text-xs text-muted-foreground">This helps you to create different types of campaigns.</p>
            <div className="space-y-3">
              <div>
                <Label>Campaign Name <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Campaign Name" />
                {errs.name && <p className="mt-1 text-xs text-destructive">{errs.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Campaign Start Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                  {errs.startDate && <p className="mt-1 text-xs text-destructive">{errs.startDate}</p>}
                </div>
                <div>
                  <Label>Campaign End Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                  {errs.endDate && <p className="mt-1 text-xs text-destructive">{errs.endDate}</p>}
                </div>
              </div>
              {demo && (
                <div>
                  <Label>Business Unit <span className="text-destructive">*</span></Label>
                  <Select value={form.businessUnit} onValueChange={v => setForm({ ...form, businessUnit: v })}><SelectTrigger><SelectValue placeholder="Choose business unit" /></SelectTrigger><SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
                  {errs.businessUnit && <p className="mt-1 text-xs text-destructive">{errs.businessUnit}</p>}
                </div>
              )}
              <div><Label>Campaign Type <span className="text-destructive">*</span></Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="flex justify-end gap-2 mt-5"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate}>Create</Button></div>
          </div>
        </div>
      )}

      {/* Recent Campaigns */}
      <div>
        <h3 className="mb-1 text-base font-semibold">Recent Campaigns</h3>
        <p className="mb-3 text-xs text-muted-foreground">This lists out all the recent communication campaigns you had setup.</p>
        <Card className="border-0 shadow-sm"><CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Impressions</TableHead><TableHead>Conversions</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No campaigns match your search.</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id} className="border-b">
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                <TableCell><Select defaultValue={c.status} onValueChange={v => updateStatus(c.id, v)}><SelectTrigger className="h-7 w-28"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></TableCell>
                <TableCell>{c.impressions.toLocaleString()}</TableCell><TableCell>{c.conversions}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => updateStatus(c.id, c.status === "active" ? "paused" : "active")}>{c.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                  <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(c.id); toast.success("Campaign ID copied"); }}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeCampaign(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody></Table></CardContent></Card>
      </div>
    </div>
  );
}
