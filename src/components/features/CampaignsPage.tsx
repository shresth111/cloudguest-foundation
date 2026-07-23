import { useState } from "react";
import { Plus, Trash2, Play, Pause, Copy, Search, ClipboardList, Image as ImageIcon, Link2, Star, MessageSquareText, Percent, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface Campaign { id: string; name: string; type: string; status: string; impressions: number; conversions: number; }
const TYPES = ["SURVEY", "BANNER", "REDIRECT"];
const STATUSES = ["draft", "scheduled", "active", "paused", "ended"];

const SURVEY_QUESTIONS = [
  { q: "Rate our food quality?", options: ["Excellent", "Good", "Average", "Could be better"] },
  { q: "Rate courteousness of our staff?", options: ["Very Good", "Average", "Could be better", "Poor"] },
  { q: "How do you rate our cleanliness?", options: ["Excellent", "Good", "Average", "Could be better"] },
];

export function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([
    { id: "1", name: "Summer Promo", type: "BANNER", status: "active", impressions: 2841, conversions: 423 },
    { id: "2", name: "Guest Feedback", type: "SURVEY", status: "draft", impressions: 0, conversions: 0 },
    { id: "3", name: "Weekend Special", type: "REDIRECT", status: "paused", impressions: 1520, conversions: 198 },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "SURVEY", description: "" });
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("https://zipwifi.io/welcome");

  const openCreate = (type: string) => { setForm((f) => ({ ...f, type })); setShowCreate(true); };

  const handleCreate = () => {
    if (!form.name) return;
    setItems([...items, { id: String(Date.now()), name: form.name, type: form.type, status: "draft", impressions: 0, conversions: 0 }]);
    setForm({ name: "", type: "SURVEY", description: "" });
    setShowCreate(false);
    toast.success("Campaign created");
  };

  const updateStatus = (id: string, status: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status } : i));
    toast.success(`Campaign ${status}`);
  };

  const filtered = items.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Campaign</h2><p className="text-sm text-muted-foreground">Reach, survey, and re-engage guests over your WiFi.</p></div>
        <div className="flex items-center gap-2">
          {showSearch ? (
            <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus placeholder="Search campaign…" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => !search && setShowSearch(false)} className="h-9 w-48 pl-8" /></div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowSearch(true)}><Search className="mr-2 h-4 w-4" />Search Campaign</Button>
          )}
          <Button onClick={() => openCreate("SURVEY")}><Plus className="mr-2 h-4 w-4" />Create Campaign</Button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">New Campaign</h3>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Summer Sale" /></div>
              <div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate}>Create</Button></div>
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
            {filtered.length === 0 ? (
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
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setItems(items.filter(i => i.id !== c.id)); toast.success("Campaign deleted"); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody></Table></CardContent></Card>
      </div>
    </div>
  );
}
