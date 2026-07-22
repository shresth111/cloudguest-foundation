import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useOrgLocationLookup } from "@/hooks/useMonitoring";
import type { AuditListQuery } from "@/types/audit";

type Filters = Omit<AuditListQuery, "page" | "pageSize">;

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

export function AuditFiltersBar({ filters, onChange, onClear }: Props) {
  const { locations } = useOrgLocationLookup();
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Filter by action (e.g. router_provisioned)…"
        value={filters.action ?? ""}
        onChange={(e) => onChange({ action: e.target.value || undefined })}
        className="h-9 max-w-xs"
      />
      <Input
        placeholder="Entity type (e.g. router, user)…"
        value={filters.entityType ?? ""}
        onChange={(e) => onChange({ entityType: e.target.value || undefined })}
        className="h-9 max-w-xs"
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" /> Advanced
            {activeCount > 0 && (
              <Badge className="ml-2" variant="secondary">
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[320px] space-y-3">
          <Row label="Location">
            <Select
              value={filters.locationId ?? "all"}
              onValueChange={(v) => onChange({ locationId: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Actor user ID">
            <Input
              value={filters.actorUserId ?? ""}
              onChange={(e) => onChange({ actorUserId: e.target.value || undefined })}
              placeholder="UUID"
              className="h-9"
            />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <Row label="From">
              <Input
                type="datetime-local"
                value={filters.start ?? ""}
                onChange={(e) => onChange({ start: e.target.value || undefined })}
                className="h-9"
              />
            </Row>
            <Row label="To">
              <Input
                type="datetime-local"
                value={filters.end ?? ""}
                onChange={(e) => onChange({ end: e.target.value || undefined })}
                className="h-9"
              />
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
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
