import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Network, CalendarClock, RotateCcw } from "lucide-react";

interface Policy { id: string; name: string; type: string; status: string; enabled: boolean; }
interface WhitelistEntry { id: string; mac: string; name: string; type: string; status: string; }
interface Team { id: string; name: string; members: number; quota: number; status: string; }
interface NetworkItem { id: string; name: string; status: string; detail: string; }
interface AdvancedItem { id: string; name: string; desc: string; enabled: boolean; }

export function PoliciesPage() {
  const [items, setItems] = useState<Policy[]>([
    { id: "1", name: "Authentication Policy", type: "auth", status: "active", enabled: true },
    { id: "2", name: "Bandwidth Policy", type: "bandwidth", status: "active", enabled: true },
    { id: "3", name: "Session Policy", type: "session", status: "active", enabled: true },
    { id: "4", name: "Data Policy", type: "data", status: "draft", enabled: false },
    { id: "5", name: "Access Policy", type: "access", status: "active", enabled: true },
    { id: "6", name: "Portal Policy", type: "portal", status: "draft", enabled: false },
  ]);
  return (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(p => (
    <Card key={p.id} className="shadow-sm border-0"><CardContent className="p-4">
      <div className="flex items-center justify-between mb-2"><p className="font-semibold text-sm">{p.name}</p><Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize text-[10px]">{p.status}</Badge></div>
      <p className="text-xs text-muted-foreground mb-3 capitalize">{p.type} policy</p>
      <div className="flex items-center justify-between"><Switch checked={p.enabled} onCheckedChange={v => { setItems(items.map(x => x.id === p.id ? { ...x, enabled: v, status: v ? "active" : "draft" } : x)); toast.success(`${p.name} ${v ? "enabled" : "disabled"}`); }} /><span className="text-xs text-muted-foreground">{p.enabled ? "Enabled" : "Disabled"}</span></div>
    </CardContent></Card>
  ))}</div>);
}

export function WhitelistPage() {
  const [items, setItems] = useState<WhitelistEntry[]>([
    { id: "1", mac: "00:1A:2B:3C:4D:5E", name: "John's iPhone", type: "permanent", status: "active" },
    { id: "2", mac: "AA:BB:CC:DD:EE:FF", name: "Office Printer", type: "permanent", status: "active" },
    { id: "3", mac: "11:22:33:44:55:66", name: "Guest Laptop", type: "temporary", status: "active" },
  ]);
  return (<div className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Device Whitelist</h2></div>
      <Button size="sm" onClick={() => { const mac = Array.from({length:6},()=>Math.floor(Math.random()*256).toString(16).padStart(2,"0")).join(":").toUpperCase(); setItems([...items,{id:String(Date.now()),mac,name:"New Device",type:"temporary",status:"active"}]); toast.success("Device added to whitelist"); }}><Plus className="mr-1 h-4 w-4"/>Add Device</Button></div>
    <Card className="shadow-sm border-0"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">MAC Address</TableHead><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-right text-xs">Actions</TableHead></TableRow></TableHeader>
    <TableBody>{items.map(v => (<TableRow key={v.id} className="border-b"><TableCell className="font-mono text-xs">{v.mac}</TableCell><TableCell className="text-sm">{v.name}</TableCell><TableCell className="text-xs capitalize">{v.type}</TableCell><TableCell><Badge variant={v.status==="active"?"default":"secondary"} className="capitalize text-[10px]">{v.status}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={()=>{setItems(items.filter(x=>x.id!==v.id));toast.success("Removed from whitelist")}}><Trash2 className="h-3.5 w-3.5"/></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

export function TeamsPage() {
  const [items, setItems] = useState<Team[]>([{id:"1",name:"Sales Team",members:12,quota:85,status:"active"},{id:"2",name:"Executive VIP",members:5,quota:42,status:"active"},{id:"3",name:"Contractors",members:8,quota:100,status:"active"}]);
  return (<div className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Guest Teams</h2></div>
      <Button size="sm" onClick={()=>{setItems([...items,{id:String(Date.now()),name:`Team ${items.length+1}`,members:0,quota:0,status:"active"}]);toast.success("Team created")}}><Plus className="mr-1 h-4 w-4"/>Create Team</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(t => (
      <Card key={t.id} className="shadow-sm border-0"><CardContent className="p-5">
        <div className="flex items-center justify-between mb-2"><p className="font-semibold text-sm">{t.name}</p><Badge variant="outline">{t.members} members</Badge></div>
        <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Quota used</span><span>{t.quota}%</span></div>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{width:`${t.quota}%`}} /></div>
        <div className="flex gap-2 mt-3"><Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={()=>toast.success(`${t.name} updated`)}>Manage</Button><Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={()=>{setItems(items.filter(x=>x.id!==t.id));toast.success("Team revoked")}}>Revoke</Button></div>
      </CardContent></Card>
    ))}</div>
  </div>);
}

export function NetworkingPage() {
  const items: NetworkItem[] = [
    {id:"1",name:"VLAN",status:"active",detail:"5 VLANs configured"}, {id:"2",name:"DHCP",status:"active",detail:"3 pools, 245 active leases"},
    {id:"3",name:"DNS",status:"active",detail:"8 records, 2 zones"}, {id:"4",name:"Firewall",status:"active",detail:"12 rules enabled"},
    {id:"5",name:"Hotspot",status:"active",detail:"Enabled on 2 SSIDs"}, {id:"6",name:"ISP",status:"warning",detail:"Primary + Backup configured"},
  ];
  const [rebooting, setRebooting] = useState(false);
  const reboot = () => {
    setRebooting(true);
    toast.promise(new Promise((res) => setTimeout(res, 2000)), { loading: "Rebooting network…", success: "Network rebooted", error: "Reboot failed" });
    setTimeout(() => setRebooting(false), 2000);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2 text-sm"><Network className="h-4 w-4 text-primary" /><span className="text-muted-foreground">Total Networks:</span> <span className="font-semibold">2</span></span>
          <span className="flex items-center gap-2 text-sm"><CalendarClock className="h-4 w-4 text-primary" /><span className="text-muted-foreground">Plan Expiry:</span> <span className="font-semibold">11-Nov-2026</span></span>
        </div>
        <Button size="sm" variant="outline" disabled={rebooting} onClick={reboot}><RotateCcw className={`h-4 w-4 ${rebooting ? "animate-spin" : ""}`} />Reboot</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => (
        <Card key={item.id} className="shadow-sm border-0 hover:shadow-md cursor-pointer"><CardContent className="p-5">
          <div className="flex items-center justify-between mb-2"><p className="font-semibold text-sm">{item.name}</p><Badge variant={item.status==="active"?"default":"secondary"} className="capitalize text-[10px]">{item.status}</Badge></div>
          <p className="text-xs text-muted-foreground">{item.detail}</p>
          <Button size="sm" variant="outline" className="h-7 text-xs mt-3" onClick={()=>toast.success(`${item.name} settings opened`)}>Configure</Button>
        </CardContent></Card>
      ))}</div>
    </div>
  );
}

export function AdvancedPage() {
  const [items, setItems] = useState<AdvancedItem[]>([
    {id:"1",name:"API Access",desc:"Enable REST API access",enabled:true},{id:"2",name:"MFA",desc:"Require multi-factor auth",enabled:false},
    {id:"3",name:"Email Alerts",desc:"Send alert notifications via email",enabled:true},{id:"4",name:"Auto Backup",desc:"Automated config backups",enabled:true},
    {id:"5",name:"Health Checks",desc:"Periodic health monitoring",enabled:true},{id:"6",name:"Debug Logging",desc:"Verbose system logs",enabled:false},
  ]);
  return (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => (
    <Card key={item.id} className="shadow-sm border-0"><CardContent className="p-5">
      <p className="font-semibold text-sm">{item.name}</p><p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
      <div className="flex items-center justify-between mt-3"><span className="text-xs text-muted-foreground">{item.enabled ? "Enabled" : "Disabled"}</span>
        <Switch checked={item.enabled} onCheckedChange={v=>{setItems(items.map(x=>x.id===item.id?{...x,enabled:v}:x));toast.success(`${item.name} ${v?"enabled":"disabled"}`)}} /></div>
    </CardContent></Card>
  ))}</div>);
}
