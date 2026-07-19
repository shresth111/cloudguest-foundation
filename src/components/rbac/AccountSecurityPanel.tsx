import { AlertTriangle, Clock, KeyRound, Laptop, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AccountSecurityPanel() {
  const items = [
    { icon: KeyRound, label: "Last password change", value: "27 days ago", tone: "text-emerald-500" },
    { icon: Clock, label: "Last login", value: new Date(Date.now() - 3.2e6).toLocaleString(), tone: "" },
    { icon: AlertTriangle, label: "Failed attempts (24h)", value: "2", tone: "text-amber-500" },
    { icon: ShieldCheck, label: "Suspicious activity", value: "None detected", tone: "text-emerald-500" },
  ];
  const devices = [
    { name: "MacBook Pro", os: "macOS 14", ip: "10.42.18.114", location: "San Francisco", trusted: true, lastSeen: "5 min ago" },
    { name: "iPhone 15", os: "iOS 17", ip: "10.42.18.201", location: "San Francisco", trusted: true, lastSeen: "1 hr ago" },
    { name: "Windows 11 Desktop", os: "Win 11", ip: "203.0.113.42", location: "Mumbai", trusted: false, lastSeen: "3 days ago" },
  ];

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Account security</h3>
          <p className="text-xs text-muted-foreground">Overview of the signed-in account's security posture.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((i) => {
            const Icon = i.icon;
            return (
              <div key={i.label} className="rounded-lg border p-3">
                <div className={`flex items-center gap-2 text-xs ${i.tone}`}><Icon className="h-3.5 w-3.5" /> {i.label}</div>
                <p className="mt-2 text-sm font-semibold">{i.value}</p>
              </div>
            );
          })}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Trusted devices</p>
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Laptop className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.name} · {d.os}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.ip} · {d.location} · {d.lastSeen}</p>
                  </div>
                </div>
                <Badge variant={d.trusted ? "default" : "outline"}>{d.trusted ? "Trusted" : "Unrecognized"}</Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
