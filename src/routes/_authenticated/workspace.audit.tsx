import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/workspace/audit")({
  component: AuditPage,
});

const rows = Array.from({ length: 12 }, (_, i) => ({
  id: `EVT-${1000 + i}`,
  actor: ["Ananya Rao", "Rohan Kapoor", "Meera Iyer", "System"][i % 4],
  action: ["login", "update_router", "create_location", "invite_user", "billing_update"][i % 5],
  target: ["LOC-90001", "RTR-LOC-90002-1", "USR-3", "INV-2025002"][i % 4],
  when: `${i + 1}h ago`,
  status: (i % 6 === 5 ? "failed" : "success") as "success" | "failed",
}));

function AuditPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Audit logs</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell>{r.actor}</TableCell>
                  <TableCell className="font-mono text-xs">{r.action}</TableCell>
                  <TableCell className="font-mono text-xs">{r.target}</TableCell>
                  <TableCell>{r.when}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "success" ? "default" : "destructive"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
