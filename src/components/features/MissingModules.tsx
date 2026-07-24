import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Globe, Clock, Bell, Image, Download, X, Search, RefreshCw, Activity, Wifi, Monitor, Terminal, Users } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

/* ── ISP Details ────────────────────────────────────────── */
export function IspDetailsPage() {
  const [items, setItems] = useState<{id:string;bu:string;wans:number;rule:string;isp1:string;isp2:string;bw1:number;bw2:number;thresh1:number;thresh2:number}[]>([
    {id:"i1",bu:"Marina Bay Hotel",wans:2,rule:"Failover",isp1:"Tata Communications",isp2:"Jio",bw1:100,bw2:200,thresh1:50,thresh2:80},
    {id:"i2",bu:"Downtown CoWork",wans:1,rule:"Load Balance",isp1:"Airtel",isp2:"",bw1:50,bw2:0,thresh1:25,thresh2:0},
  ]);
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">ISP Details</h1>
    <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 flex items-start gap-3"><Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><p className="text-sm text-amber-800">Manage your ISPs, load balancing and failover rules.</p></div>
    <Card><CardContent className="p-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-4"><div><Label>Business Unit</Label><Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="m">Marina Bay Hotel</SelectItem></SelectContent></Select></div>
      <div><Label>Total Interfaces</Label><Select><SelectTrigger><SelectValue placeholder="2" /></SelectTrigger><SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent></Select></div>
      <div><Label>Rule</Label><Select><SelectTrigger><SelectValue placeholder="Failover" /></SelectTrigger><SelectContent><SelectItem value="failover">Failover</SelectItem><SelectItem value="load">Load Balance</SelectItem></SelectContent></Select></div></div>
      <div className="grid gap-4 md:grid-cols-2">{[1,2].map(n=>(<div key={n} className="space-y-3 border p-4 rounded-lg"><p className="font-medium text-sm">ISP {n}</p><Input placeholder="Provider name" /><Select><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="fiber">Fiber</SelectItem><SelectItem value="dsl">DSL</SelectItem></SelectContent></Select><div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="BW Mbps" /><Input type="number" placeholder="Threshold" /></div><div className="flex gap-3"><label className="flex items-center gap-1.5 text-xs"><Switch /> Email alert</label><label className="flex items-center gap-1.5 text-xs"><Switch /> SMS alert</label></div></div>))}</div>
      <Button onClick={()=>toast.success("ISP configuration saved")}>Update</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-sm">ISP Configurations</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">Business</TableHead><TableHead className="text-xs">WANs</TableHead><TableHead className="text-xs">Rule</TableHead><TableHead className="text-xs">ISP1</TableHead><TableHead className="text-xs">ISP2</TableHead><TableHead className="text-xs">Bandwidth</TableHead><TableHead className="text-right text-xs">Action</TableHead></TableRow></TableHeader><TableBody>{items.map(i=>(<TableRow key={i.id}><TableCell className="font-medium">{i.bu}</TableCell><TableCell>{i.wans}</TableCell><TableCell><Badge variant="outline">{i.rule}</Badge></TableCell><TableCell>{i.isp1}</TableCell><TableCell>{i.isp2||"—"}</TableCell><TableCell>{i.bw1}/{i.bw2} Mbps</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive" onClick={()=>{setItems(items.filter(x=>x.id!==i.id));toast.success("Removed")}}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── Top Up Data ─────────────────────────────────────────── */
export function TopUpDataPage() {
  const [items, setItems] = useState([{id:"t1",bu:"Marina Bay Hotel",name:"Ravi Sharma",mobile:"+919876543210",limit:"5 GB",date:"21-07-2026"}]);
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">Top Up Data</h1>
    <Card><CardContent className="p-6 space-y-4"><p className="text-sm text-slate-400">Give a guest more data once they've used up their limit.</p>
      <div className="grid gap-4 md:grid-cols-4"><div><Label>Business Unit</Label><Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="m">Marina Bay Hotel</SelectItem></SelectContent></Select></div>
      <div><Label>Data Limit</Label><Input type="number" placeholder="0" /></div>
      <div><Label>Unit</Label><Select><SelectTrigger><SelectValue placeholder="GB" /></SelectTrigger><SelectContent><SelectItem value="GB">GB</SelectItem><SelectItem value="MB">MB</SelectItem></SelectContent></Select></div>
      <div><Label>Mobile Number</Label><Input placeholder="+919876543210" /></div></div>
      <Button onClick={()=>toast.success("Top up saved")}>Save</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-sm">Recent Top Ups</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">Business</TableHead><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Mobile</TableHead><TableHead className="text-xs">Data</TableHead><TableHead className="text-xs">Date</TableHead><TableHead className="text-right text-xs">Action</TableHead></TableRow></TableHeader><TableBody>{items.map(i=>(<TableRow key={i.id}><TableCell>{i.bu}</TableCell><TableCell className="font-medium">{i.name}</TableCell><TableCell className="font-mono text-xs">{i.mobile}</TableCell><TableCell>{i.limit}</TableCell><TableCell className="text-xs text-slate-400">{i.date}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive" onClick={()=>{setItems(items.filter(x=>x.id!==i.id));toast.success("Removed")}}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── Business Hours ──────────────────────────────────────── */
export function BusinessHoursPage() {
  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const [hours, setHours] = useState(DAYS.map(d=>({day:d,open:["Mon","Tue","Wed","Thu","Fri"].includes(d),from:"09:00",to:"18:00"})));
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">Business Hours</h1>
    <Card><CardContent className="p-6 space-y-4">
      {hours.map(h=>(<div key={h.day} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg"><span className="w-10 text-sm font-medium">{h.day}</span>
        <div className="flex items-center gap-2"><Switch checked={h.open} onCheckedChange={v=>setHours(hours.map(x=>x.day===h.day?{...x,open:v}:x))} /><span className="text-xs text-slate-400">{h.open?"Open":"Closed"}</span></div>
        <Input type="time" value={h.from} onChange={e=>setHours(hours.map(x=>x.day===h.day?{...x,from:e.target.value}:x))} disabled={!h.open} className="w-28" />
        <Input type="time" value={h.to} onChange={e=>setHours(hours.map(x=>x.day===h.day?{...x,to:e.target.value}:x))} disabled={!h.open} className="w-28" />
      </div>))}
      <div className="flex items-center gap-2 pt-2"><input type="checkbox" id="strict" className="rounded" /><label htmlFor="strict" className="text-sm text-slate-600">Strict business hours — ends sessions outside these hours</label></div>
      <Button onClick={()=>toast.success("Business hours updated")}>Apply</Button>
    </CardContent></Card>
  </div>);
}

/* ── Notification ────────────────────────────────────────── */
export function NotificationPage() {
  const [type, setType] = useState("text");
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">Notification</h1>
    <Card><CardContent className="p-6 space-y-4"><p className="text-sm text-slate-400">Show a message to guests before they log in.</p>
      <div className="grid gap-4 md:grid-cols-2"><div><Label>Business Unit</Label><Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="m">Marina Bay Hotel</SelectItem></SelectContent></Select></div>
      <div><Label>Notification Type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="text-tc">Text with T&C</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="image-tc">Image with T&C</SelectItem></SelectContent></Select></div></div>
      {(type.includes("text")) && <div><Label>Message</Label><textarea className="w-full rounded border border-slate-200 p-3 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Enter notification message…" /></div>}
      {(type.includes("image")) && <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center"><Image className="mx-auto h-8 w-8 text-slate-300 mb-2" /><p className="text-sm text-slate-400">Drop image here or click to browse</p></div>}
      {(type.includes("tc")) && <div><Label>Terms & Conditions</Label><textarea className="w-full rounded border border-slate-200 p-3 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="T&C text…" /></div>}
      <Button onClick={()=>toast.success("Notification saved")}>Save</Button>
    </CardContent></Card>
  </div>);
}

/* ── Audit Log ───────────────────────────────────────────── */
export function AuditLogPage() {
  const items = [{ts:"21-07-2026 14:30",actor:"admin@zipwifi.io",event:"Policy Updated",resource:"Location Policies",ip:"203.0.113.42",before:"2 Mbps",after:"5 Mbps"},{ts:"21-07-2026 12:15",actor:"support@zipwifi.io",event:"User Blocked",resource:"Block Users",ip:"198.51.100.15",before:"Active",after:"Blocked"},{ts:"20-07-2026 18:45",actor:"system",event:"Voucher Created",resource:"Vouchers",ip:"—",before:"—",after:"100 vouchers"}];
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
    <div className="flex flex-wrap gap-3"><div className="w-full sm:w-48"><Label>From</Label><Input type="date" /></div><div className="w-full sm:w-48"><Label>To</Label><Input type="date" /></div><div className="w-full sm:w-48"><Label>Location</Label><Select><SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem></SelectContent></Select></div><Button className="self-end" onClick={()=>toast.success("Search completed")}>Search</Button></div>
    <Card><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs">Timestamp</TableHead><TableHead className="text-xs">Actor</TableHead><TableHead className="text-xs">Event</TableHead><TableHead className="text-xs">Resource</TableHead><TableHead className="text-xs">IP</TableHead><TableHead className="text-xs">Before</TableHead><TableHead className="text-xs">After</TableHead></TableRow></TableHeader><TableBody>{items.map((i,idx)=>(<TableRow key={idx} className="border-b"><TableCell className="text-xs whitespace-nowrap">{i.ts}</TableCell><TableCell className="text-xs">{i.actor}</TableCell><TableCell>{i.event}</TableCell><TableCell className="text-xs">{i.resource}</TableCell><TableCell className="font-mono text-xs">{i.ip}</TableCell><TableCell className="text-xs text-slate-400 line-through">{i.before}</TableCell><TableCell className="text-xs font-medium text-slate-800">{i.after}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── Admin Logs ──────────────────────────────────────────── */
export function AdminLogsPage() {
  const items = [{ts:"21-07-2026 14:30",admin:"admin@zipwifi.io",role:"Super Admin",action:"Updated Policy",module:"Location Policies",target:"Marina Bay Hotel",ip:"203.0.113.42",details:"Bandwidth changed 2→5 Mbps"},{ts:"21-07-2026 12:15",admin:"support@zipwifi.io",role:"Support Agent",action:"Blocked User",module:"Block Users",target:"+919876543210",ip:"198.51.100.15",details:"Blocked for policy violation"}];
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">Admin Logs</h1>
    <div className="flex flex-wrap gap-3 items-end"><div className="w-full sm:w-48"><Label>From</Label><Input type="date" /></div><div className="w-full sm:w-48"><Label>To</Label><Input type="date" /></div><div className="w-full sm:w-48"><Label>Location</Label><Select><SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem></SelectContent></Select></div><Button onClick={()=>toast.success("Search completed")}>Search</Button><Button variant="outline" className="ml-auto" onClick={()=>toast.success("CSV exported")}><Download className="mr-1.5 h-4 w-4" />Export CSV</Button></div>
    <Card><CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs">Timestamp</TableHead><TableHead className="text-xs">Admin</TableHead><TableHead className="text-xs">Role</TableHead><TableHead className="text-xs">Action</TableHead><TableHead className="text-xs">Module</TableHead><TableHead className="text-xs">Target</TableHead><TableHead className="text-xs">IP</TableHead><TableHead className="text-xs">Details</TableHead></TableRow></TableHeader><TableBody>{items.map((i,idx)=>(<TableRow key={idx} className="border-b"><TableCell className="text-xs whitespace-nowrap">{i.ts}</TableCell><TableCell className="text-xs">{i.admin}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{i.role}</Badge></TableCell><TableCell className="text-xs">{i.action}</TableCell><TableCell className="text-xs">{i.module}</TableCell><TableCell className="text-xs">{i.target}</TableCell><TableCell className="font-mono text-xs">{i.ip}</TableCell><TableCell className="text-xs max-w-[200px] truncate" title={i.details}>{i.details}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── MAC Authorization ───────────────────────────────────── */
export function MacAuthorizationPage() {
  const [items]=useState([{id:"m1",mac:"00:1A:2B:3C:4D:5E",hostname:"Office Printer",ip:"10.0.1.100",status:"Active",bypassed:true},{id:"m2",mac:"AA:BB:CC:DD:EE:FF",hostname:"Security Camera",ip:"10.0.1.101",status:"Active",bypassed:false}]);
  return (<div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold text-slate-800">MAC Authorization</h1><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>toast.success("Syncing…")}><RefreshCw className="mr-1.5 h-4 w-4" />Sync</Button><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Device</Button></div></div>
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">MAC</TableHead><TableHead className="text-xs">Hostname</TableHead><TableHead className="text-xs">IP</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Bypassed</TableHead><TableHead className="text-right text-xs">Action</TableHead></TableRow></TableHeader><TableBody>{items.map(i=>(<TableRow key={i.mac} className="border-b"><TableCell className="font-mono text-xs">{i.mac}</TableCell><TableCell>{i.hostname}</TableCell><TableCell className="font-mono text-xs">{i.ip}</TableCell><TableCell><Badge variant="default" className="bg-emerald-500/15 text-emerald-600">{i.status}</Badge></TableCell><TableCell>{i.bypassed?<Badge className="bg-emerald-500/15 text-emerald-600">Yes</Badge>:<Badge variant="outline">No</Badge>}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── Port Forwarding ─────────────────────────────────────── */
export function PortForwardingPage() {
  const [items]=useState([{id:"p1",dst:"10.0.1.10",to:"192.168.1.50",dport:8080,tport:80,proto:"TCP",active:true}]);
  return (<div className="space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-slate-800">Port Forwarding</h1><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add Rule</Button></div>
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">Destination</TableHead><TableHead className="text-xs">To Address</TableHead><TableHead className="text-xs">Dst Port</TableHead><TableHead className="text-xs">To Port</TableHead><TableHead className="text-xs">Protocol</TableHead><TableHead className="text-xs">Active</TableHead><TableHead className="text-right text-xs">Action</TableHead></TableRow></TableHeader><TableBody>{items.map(i=>(<TableRow key={i.id} className="border-b"><TableCell className="font-mono text-xs">{i.dst}</TableCell><TableCell className="font-mono text-xs">{i.to}</TableCell><TableCell>{i.dport}</TableCell><TableCell>{i.tport}</TableCell><TableCell className="text-xs">{i.proto}</TableCell><TableCell><Switch checked={i.active} /></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── DHCP Pool ───────────────────────────────────────────── */
export function DhcpPoolPage() {
  const [items]=useState([{id:"d1",cidr:"192.168.1.0/24",range:"192.168.1.100-200",interface:"br-lan",leases:142,max:254}]);
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">DHCP Pool</h1>
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">CIDR</TableHead><TableHead className="text-xs">Range</TableHead><TableHead className="text-xs">Interface</TableHead><TableHead className="text-xs">Leases</TableHead></TableRow></TableHeader><TableBody>{items.map(i=>(<TableRow key={i.id} className="border-b"><TableCell className="font-mono text-xs">{i.cidr}</TableCell><TableCell className="font-mono text-xs">{i.range}</TableCell><TableCell className="text-xs">{i.interface}</TableCell><TableCell><div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-orange-500" style={{width:`${(i.leases/i.max)*100}%`}}/></div><span className="text-xs">{i.leases}/{i.max}</span></div></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── VLAN Management ─────────────────────────────────────── */
export function VlanManagementPage() {
  const [items]=useState([{id:"v1",subnet:"192.168.10.0/24",gateway:"192.168.10.1",name:"Guest Network",vlanId:100}]);
  return (<div className="space-y-6">
    <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-slate-800">VLAN Management</h1><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add VLAN</Button></div>
    <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 flex items-start gap-3"><Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><p className="text-sm text-amber-800">A wrong value here can take the network down.</p></div>
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">Subnet</TableHead><TableHead className="text-xs">Gateway</TableHead><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">VLAN ID</TableHead><TableHead className="text-right text-xs">Action</TableHead></TableRow></TableHeader><TableBody>{items.map(i=>(<TableRow key={i.id} className="border-b"><TableCell className="font-mono text-xs">{i.subnet}</TableCell><TableCell className="font-mono text-xs">{i.gateway}</TableCell><TableCell>{i.name}</TableCell><TableCell><Badge variant="outline">{i.vlanId}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── VOIP Priority ───────────────────────────────────────── */
export function VoipPriorityPage() {
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">VOIP Priority</h1>
    <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 flex items-start gap-3"><Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><p className="text-sm text-amber-800">Gives voice and video calls priority over other traffic.</p></div>
    <Card><CardContent className="p-6 space-y-4">
      <div className="flex items-center justify-between"><div><p className="font-medium">Prioritise VOIP traffic</p><p className="text-xs text-slate-400">Voice and video calls get priority over other traffic on this network.</p></div><Switch /></div>
      <Button onClick={()=>toast.success("VOIP priority updated")}>Update VOIP Priority</Button>
    </CardContent></Card>
  </div>);
}

/* ── ISP Routing ─────────────────────────────────────────── */
export function IspRoutingPage() {
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">ISP Routing</h1><div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 flex items-start gap-3"><Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"/><p className="text-sm text-amber-800">Route specific VLANs or IPs through a specific ISP.</p></div>
    <div className="flex flex-wrap gap-3"><Select><SelectTrigger className="w-44"><SelectValue placeholder="Route a VLAN" /></SelectTrigger><SelectContent><SelectItem value="vlan">Route a VLAN</SelectItem><SelectItem value="ip">Route an IP</SelectItem></SelectContent></Select><Select><SelectTrigger className="w-44"><SelectValue placeholder="Select ISP" /></SelectTrigger><SelectContent><SelectItem value="tata">Tata Communications</SelectItem><SelectItem value="jio">Jio</SelectItem></SelectContent></Select><Button onClick={()=>toast.success("Route added")}>Add Route</Button></div>
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">VLAN/IP</TableHead><TableHead className="text-xs">ISP</TableHead><TableHead className="text-xs">Interface</TableHead><TableHead className="text-xs">Active</TableHead><TableHead className="text-right text-xs">Action</TableHead></TableRow></TableHeader><TableBody><TableRow className="border-b"><TableCell>Guest Network (VLAN 100)</TableCell><TableCell>Tata Communications</TableCell><TableCell>eth0.100</TableCell><TableCell><Switch defaultChecked /></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow></TableBody></Table></CardContent></Card>
  </div>);
}

/* ── Debugging Tools ─────────────────────────────────────── */
export function DebuggingToolsPage() {
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">Debugging Tools</h1>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardContent className="p-5"><p className="font-semibold text-sm mb-3">DNS Lookup</p><Input placeholder="Domain name" className="mb-2" /><select className="w-full rounded border border-slate-200 px-3 py-2 text-sm mb-2"><option>8.8.8.8</option><option>1.1.1.1</option></select><Button size="sm" onClick={()=>toast.success("DNS lookup complete")}>Test</Button></CardContent></Card>
      <Card><CardContent className="p-5"><p className="font-semibold text-sm mb-3">Reset User Session</p><Input placeholder="User IP address" className="mb-2" /><Button size="sm" variant="destructive" onClick={()=>toast.success("Session reset")}>Reset Session</Button></CardContent></Card>
      <Card><CardContent className="p-5"><p className="font-semibold text-sm mb-3">Controller Logs</p><div className="bg-slate-900 text-slate-300 font-mono text-xs p-3 rounded h-32 overflow-y-auto">[INFO] Service started<br/>[WARN] CPU at 82%<br/>[INFO] Client connected<br/>[ERROR] DHCP pool exhausted</div><div className="flex gap-2 mt-2"><Button size="sm" variant="outline" className="text-xs"><Terminal className="mr-1 h-3 w-3" />Copy</Button><Button size="sm" variant="outline" className="text-xs"><Download className="mr-1 h-3 w-3" />Download</Button></div></CardContent></Card>
    </div>
  </div>);
}

/* ── Hotspot Settings ────────────────────────────────────── */
export function HotspotSettingsPage() {
  const [settings, setSettings] = useState({autoLogin:true,groupPolicy:false,otp:true,nameCollect:true,emailCollect:true,officialEmail:false,teamName:false});
  const toggle = (k: keyof typeof settings) => { setSettings(s=>{const n={...s,[k]:!s[k]};if(!n.autoLogin&&!n.otp)toast.error("Guests will have no way to authenticate!");return n;}); };
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">Hotspot Settings</h1>
    <Card><CardContent className="p-6 space-y-4"><p className="text-sm text-slate-400">Enable or disable hotspot settings for the selected network.</p>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">{[{k:"autoLogin",l:"Auto Login"},{k:"groupPolicy",l:"Group Policy"},{k:"otp",l:"Login via OTP"},{k:"nameCollect",l:"Name Collect"},{k:"emailCollect",l:"Email Collect"},{k:"officialEmail",l:"Official Email"},{k:"teamName",l:"Team Name Collect"}].map(({k,l})=>(
        <div key={k} className="flex items-center justify-between p-3 border rounded-lg"><span className="text-sm font-medium">{l}</span><Switch checked={settings[k as keyof typeof settings]} onCheckedChange={()=>toggle(k as keyof typeof settings)} /></div>
      ))}</div>
      <Button onClick={()=>toast.success("Hotspot settings applied")}>Apply Settings</Button>
    </CardContent></Card>
  </div>);
}

/* ── RaaS Dashboard ──────────────────────────────────────── */
export function RaasDashboardPage() {
  const data = Array.from({length:15},(_,i)=>({day:i+1,sessions:20+Math.random()*80,users:10+Math.random()*40}));
  const users = [
    {unit:"The Hosteller Marathahalli",code:"THM-001",expiry:"11-Nov-2026",online:23},
    {unit:"Hosteller_Staff_Marathahalli",code:"HSM-002",expiry:"05-Dec-2026",online:5},
    {unit:"The Hosteller Indira Nagar",code:"THIN-003",expiry:"20-Oct-2026",online:18},
    {unit:"The Hosteller Coorg",code:"THC-004",expiry:"15-Jan-2027",online:12},
  ];
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">RaaS Dashboard</h1>
    <div className="grid gap-4 md:grid-cols-2">
      <Card><CardContent className="p-5 flex items-center gap-4 bg-gradient-to-br from-slate-50 to-white"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white"><Users className="h-6 w-6" /></div><div><p className="text-xs text-slate-400 uppercase">Total Users</p><p className="text-3xl font-bold">1,247</p></div></CardContent></Card>
      <Card><CardContent className="p-5 flex items-center gap-4 bg-gradient-to-br from-orange-50 to-white"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-white"><Activity className="h-6 w-6" /></div><div><p className="text-xs text-slate-400 uppercase">Active Users</p><p className="text-3xl font-bold">892</p></div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="text-sm">User Sessions (15 days)</CardTitle></CardHeader><CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/><XAxis dataKey="day" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Line type="monotone" dataKey="sessions" stroke="#f97316" strokeWidth={2}/><Line type="monotone" dataKey="users" stroke="#1e293b" strokeWidth={2}/></LineChart></ResponsiveContainer></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-sm">Location Overview</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">Business Unit</TableHead><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Plan Expiry</TableHead><TableHead className="text-xs">Online</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader><TableBody>{users.map(u=>(<TableRow key={u.code} className="border-b"><TableCell className="font-medium">{u.unit}</TableCell><TableCell className="font-mono text-xs">{u.code}</TableCell><TableCell className={cn("text-xs",new Date(u.expiry.split("-").reverse().join("-"))<new Date(Date.now()+30*86400000)?"text-amber-600 font-medium":"")}>{u.expiry}</TableCell><TableCell className="text-orange-600 font-medium">{u.online}</TableCell><TableCell><Switch defaultChecked /></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── RaaS Manage Users ──────────────────────────────────── */
export function RaasManageUsersPage() {
  const [users]=useState([{id:"u1",mobile:"+919876543210",name:"Ravi Sharma",email:"ravi@example.com",date:"21-07-2026"}]);
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">Manage Users</h1>
    <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 flex items-start gap-3"><Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><p className="text-sm text-amber-800">This gives someone access to the authorised zone.</p></div>
    <div className="grid gap-4 md:grid-cols-2">
      <Card><CardContent className="p-5"><p className="font-semibold text-sm mb-3">Add Single User</p><div className="space-y-2"><Input placeholder="Name" /><Input placeholder="Email" /><Input placeholder="+919876543210" /></div><Button className="mt-3" onClick={()=>toast.success("User created")}>Create User</Button></CardContent></Card>
      <Card><CardContent className="p-5"><p className="font-semibold text-sm mb-3">Add Bulk Users</p><div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center text-sm text-slate-400"><Download className="mx-auto h-6 w-6 mb-2" /><p>Drop CSV here</p><p className="text-xs mt-1">Max 30 MB, ~200 records</p></div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="text-sm">Current Users</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead className="text-xs">Mobile</TableHead><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Email</TableHead><TableHead className="text-xs">Created</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-right text-xs">Action</TableHead></TableRow></TableHeader><TableBody>{users.map(u=>(<TableRow key={u.id} className="border-b"><TableCell className="font-mono text-xs">{u.mobile}</TableCell><TableCell className="font-medium">{u.name}</TableCell><TableCell className="text-xs">{u.email}</TableCell><TableCell className="text-xs">{u.date}</TableCell><TableCell><Switch defaultChecked /></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
  </div>);
}

/* ── RaaS Reports ────────────────────────────────────────── */
export function RaasReportsPage() {
  const data = Array.from({length:15},(_,i)=>({day:i+1,users:10+Math.random()*40,data:100+Math.random()*500}));
  return (<div className="space-y-6">
    <h1 className="text-2xl font-bold text-slate-800">RaaS Reports</h1>
    <Card><CardContent className="p-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-2"><div><Label>Business Unit</Label><Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="m">Marina Bay Hotel</SelectItem></SelectContent></Select></div>
      <div><Label>Report Type</Label><Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="usage">Usage Report</SelectItem><SelectItem value="revenue">Revenue Report</SelectItem></SelectContent></Select></div></div>
      <Button onClick={()=>toast.success("Report generated")}><Search className="mr-2 h-4 w-4" />Search</Button>
    </CardContent></Card>
    <Card><CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><Area type="monotone" dataKey="users" stroke="#f97316" fill="#f9731622" /><Area type="monotone" dataKey="data" stroke="#1e293b" fill="#1e293b22" /></AreaChart></ResponsiveContainer></div></CardContent></Card>
  </div>);
}
