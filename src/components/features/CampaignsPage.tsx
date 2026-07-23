import { useState } from "react";
import { Plus, Trash2, Play, Pause, Copy } from "lucide-react";
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

export function CampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([
    { id: "1", name: "Summer Promo", type: "BANNER", status: "active", impressions: 2841, conversions: 423 },
    { id: "2", name: "Guest Feedback", type: "SURVEY", status: "draft", impressions: 0, conversions: 0 },
    { id: "3", name: "Weekend Special", type: "REDIRECT", status: "paused", impressions: 1520, conversions: 198 },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "SURVEY", description: "" });

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold">Campaigns</h2><p className="text-sm text-muted-foreground">{items.length} campaigns</p></div>
        <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />Create Campaign</Button>
      </div>

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

      <Card className="border-0 shadow-sm"><CardContent className="p-0">
        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Impressions</TableHead><TableHead>Conversions</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>{items.map(c => (
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
        ))}</TableBody></Table></CardContent></Card></div>
  );
}
