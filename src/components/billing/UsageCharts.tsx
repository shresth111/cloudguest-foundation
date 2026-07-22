import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cell, Pie, PieChart, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";

const SMS_DATA = [
  { month: "Jan", sent: 12400, delivered: 11800, failed: 600 },
  { month: "Feb", sent: 15200, delivered: 14800, failed: 400 },
  { month: "Mar", sent: 13800, delivered: 13200, failed: 600 },
  { month: "Apr", sent: 16500, delivered: 15900, failed: 600 },
  { month: "May", sent: 14200, delivered: 13700, failed: 500 },
  { month: "Jun", sent: 15800, delivered: 15300, failed: 500 },
];

const STORAGE_DATA = [
  { name: "Logs", value: 35 },
  { name: "Backups", value: 25 },
  { name: "Reports", value: 20 },
  { name: "Media", value: 15 },
  { name: "Other", value: 5 },
];

const API_DATA = [
  { hour: "00", calls: 1200 },
  { hour: "04", calls: 800 },
  { hour: "08", calls: 3400 },
  { hour: "12", calls: 5600 },
  { hour: "16", calls: 4800 },
  { hour: "20", calls: 2100 },
];

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function UsageCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* SMS Usage */}
      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            SMS Usage
            <Badge variant="outline" className="text-[10px]">15,800 / 20,000 this month</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SMS_DATA}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="delivered" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Delivered" />
                <Bar dataKey="failed" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Storage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={STORAGE_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {STORAGE_DATA.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {STORAGE_DATA.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  {d.name}
                </span>
                <span className="text-muted-foreground">{d.value} GB</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">API Usage (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={API_DATA}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="calls" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: 17,900 calls</span>
            <Badge variant="outline" className="text-[10px]">+12% vs yesterday</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Storage & API combined */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">License Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Enterprise License", status: "Active", expiry: "Dec 31, 2025", seats: 50, used: 42 },
            { label: "SMS Pack", status: "Active", expiry: "Aug 15, 2025", seats: 5000, used: 3200 },
            { label: "API Add-on", status: "Active", expiry: "Oct 1, 2025", seats: 100000, used: 45000 },
          ].map((l) => (
            <div key={l.label} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{l.label}</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[10px]">{l.status}</Badge>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Expires {l.expiry}</span>
                <span>{l.used}/{l.seats} used</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
