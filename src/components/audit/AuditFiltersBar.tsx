import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { AuditFilters as F } from "@/types/audit";
import type { AuditFacets } from "@/services/audit.service";

interface Props {
  filters: F;
  onChange: (patch: Partial<F>) => void;
  onClear: () => void;
  facets: AuditFacets;
}

export function AuditFiltersBar({ filters, onChange, onClear, facets }: Props) {
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "search" && v && v !== "all").length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search user, email, IP, log ID, resource…"
        value={filters.search ?? ""}
        onChange={(e) => onChange({ search: e.target.value })}
        className="h-9 max-w-sm"
      />

      <SmallSelect value={filters.category ?? "all"} onValueChange={(v) => onChange({ category: v as F["category"] })}
        options={[{ v: "all", l: "All categories" }, ...facets.categories.map((c) => ({ v: c, l: cap(c) }))]} />

      <SmallSelect value={filters.severity ?? "all"} onValueChange={(v) => onChange({ severity: v as F["severity"] })}
        options={[{ v: "all", l: "All severities" }, ...facets.severities.map((c) => ({ v: c, l: cap(c) }))]} />

      <SmallSelect value={filters.status ?? "all"} onValueChange={(v) => onChange({ status: v as F["status"] })}
        options={[{ v: "all", l: "All statuses" }, ...facets.statuses.map((c) => ({ v: c, l: cap(c) }))]} />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" /> Advanced
            {activeCount > 0 && <Badge className="ml-2" variant="secondary">{activeCount}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[340px] space-y-3">
          <Row label="Organization">
            <Select value={filters.organizationId ?? "all"} onValueChange={(v) => onChange({ organizationId: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {facets.organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Location">
            <Select value={filters.locationId ?? "all"} onValueChange={(v) => onChange({ locationId: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {facets.locations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="User">
            <Select value={filters.userId ?? "all"} onValueChange={(v) => onChange({ userId: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {facets.users.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Module">
            <Select value={filters.module ?? "all"} onValueChange={(v) => onChange({ module: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {facets.modules.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Action">
            <Select value={filters.action ?? "all"} onValueChange={(v) => onChange({ action: v as F["action"] })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">All actions</SelectItem>
                {facets.actions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Device">
            <Select value={filters.device ?? "all"} onValueChange={(v) => onChange({ device: v === "all" ? undefined : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All devices" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All devices</SelectItem>
                {facets.devices.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Browser">
            <Select value={filters.browser ?? "all"} onValueChange={(v) => onChange({ browser: v === "all" ? undefined : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="All browsers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All browsers</SelectItem>
                {facets.browsers.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="IP address">
            <Input value={filters.ipAddress ?? ""} onChange={(e) => onChange({ ipAddress: e.target.value })} placeholder="e.g. 10.20." className="h-9" />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="From">
              <Input type="datetime-local" value={filters.from ?? ""} onChange={(e) => onChange({ from: e.target.value })} className="h-9" />
            </Row>
            <Row label="To">
              <Input type="datetime-local" value={filters.to ?? ""} onChange={(e) => onChange({ to: e.target.value })} className="h-9" />
            </Row>
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="h-9" onClick={onClear}>
          <X className="mr-1 h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SmallSelect({ value, onValueChange, options }: { value: string; onValueChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
