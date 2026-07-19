import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, ShieldCheck, Ban, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageShell, SectionHeader } from "@/components/ui-ext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nasService } from "@/services/nas.service";

export const Route = createFileRoute("/_authenticated/nas/id-generator")({
  component: NasIdGeneratorPage,
});

const CITY_CODES = [
  { code: "DEL", label: "Delhi" },
  { code: "MUM", label: "Mumbai" },
  { code: "BLR", label: "Bengaluru" },
  { code: "HYD", label: "Hyderabad" },
  { code: "PUN", label: "Pune" },
  { code: "CHN", label: "Chennai" },
];

function NasIdGeneratorPage() {
  const qc = useQueryClient();
  const reservations = useQuery({ queryKey: ["nas-reservations"], queryFn: () => nasService.listReservations() });

  const [city, setCity] = useState("DEL");
  const [manualId, setManualId] = useState("");
  const [note, setNote] = useState("");
  const [validity, setValidity] = useState<"idle" | "available" | "taken">("idle");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["nas-reservations"] });

  async function autoGenerate() {
    const id = await nasService.generateNasId(city);
    toast.success(`Reserved ${id}`);
    invalidate();
  }

  async function validate() {
    if (!manualId.trim()) return;
    const ok = await nasService.isNasIdAvailable(manualId);
    setValidity(ok ? "available" : "taken");
  }

  async function reserve() {
    try {
      const row = await nasService.reserveNasId(manualId, note || undefined);
      toast.success(`Reserved ${row.id}`);
      setManualId("");
      setNote("");
      setValidity("idle");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reserve failed");
    }
  }

  async function release(id: string) {
    await nasService.releaseNasId(id);
    toast(`Released ${id}`);
    invalidate();
  }

  return (
    <PageShell mesh>
      <SectionHeader
        eyebrow="Infrastructure"
        title="NAS ID Generator"
        description="Generate, reserve and validate unique NAS identifiers. Enforces duplicate prevention across every customer."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Auto Generate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <Label className="text-xs">City / Region</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CITY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={autoGenerate}>Generate</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Format: <span className="font-mono">NAS-{city}-XXXX</span>. Sequence is reserved on the platform registry — duplicates are impossible.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Manual Reserve
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">NAS Identifier</Label>
              <Input
                value={manualId}
                onChange={(e) => {
                  setManualId(e.target.value.toUpperCase());
                  setValidity("idle");
                }}
                placeholder="NAS-DEL-0099"
                className="mt-1 font-mono"
              />
              {validity !== "idle" && (
                <p className={`mt-1 text-xs ${validity === "available" ? "text-emerald-600" : "text-destructive"}`}>
                  {validity === "available" ? "Available" : "Already reserved"}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bengaluru pipeline" className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={validate} disabled={!manualId}>Validate</Button>
              <Button onClick={reserve} disabled={!manualId || validity === "taken"}>Reserve</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NAS Identifier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Location</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reservations.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === "assigned" ? "default" : r.status === "reserved" ? "secondary" : "outline"}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.assignedLocationId ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.note ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.reservedAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { navigator.clipboard.writeText(r.id); toast("Copied"); }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {r.status !== "released" && (
                        <Button size="icon" variant="ghost" onClick={() => release(r.id)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
