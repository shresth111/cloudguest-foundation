import { useState } from "react";
import { Key, Plus, Copy, Check, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const LICENSES = [
  { id: "l1", key: "CG-ENT-A7X2-K9M4-Q3R8", type: "Enterprise", seats: 50, used: 42, expires: "2025-12-31", status: "active" },
  { id: "l2", key: "CG-SMS-B2Y5-P1L7-V6S3", type: "SMS Pack", seats: 5000, used: 3200, expires: "2025-08-15", status: "active" },
  { id: "l3", key: "CG-API-C4W8-D6N2-X5T9", type: "API Add-on", seats: 100000, used: 45000, expires: "2025-10-01", status: "active" },
  { id: "l4", key: "CG-SPT-D8E1-F3H6-K7M2", type: "Support", seats: 10, used: 8, expires: "2025-09-30", status: "active" },
];

export function LicenseManagement() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast.success("License key copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Key className="h-4 w-4" />
          License keys
        </CardTitle>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add license
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>License key</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {LICENSES.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.type}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{l.key.slice(0, 12)}…</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(l.key, l.id)}>
                      {copiedId === l.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.used}/{l.seats}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.expires}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 capitalize">{l.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="h-7 text-xs">Deactivate</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
