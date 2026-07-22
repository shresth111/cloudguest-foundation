import { useState } from "react";
import { Filter, X, Download, RotateCcw, Search, Calendar, Building2, MapPin, Wifi, Router, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FilterField {
  id: string;
  label: string;
  type: "select" | "multiSelect" | "dateRange" | "search";
  icon?: typeof Filter;
  options?: { value: string; label: string }[];
}

interface FilterValues {
  [key: string]: string | string[] | undefined;
}

interface AdvancedFilterProps {
  fields: FilterField[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onExport?: () => void;
  title?: string;
}

const FIELD_ICONS: Record<string, typeof Filter> = {
  status: Shield,
  organization: Building2,
  location: MapPin,
  ssid: Wifi,
  router: Router,
  role: Users,
};

export function AdvancedFilter({ fields, values, onChange, onExport, title = "Filters" }: AdvancedFilterProps) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(values).filter((v) => v !== undefined && v !== "" && (Array.isArray(v) ? v.length > 0 : true)).length;

  const updateField = (id: string, value: string | string[] | undefined) => {
    onChange({ ...values, [id]: value });
  };

  const clearAll = () => {
    const cleared: FilterValues = {};
    fields.forEach((f) => { cleared[f.id] = undefined; });
    onChange(cleared);
  };

  const removeFilter = (id: string) => {
    updateField(id, undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          {title}
          {activeCount > 0 && (
            <Badge className="ml-2 h-4 px-1 text-[9px]">{activeCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Card className="border-0 shadow-none">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{title}</span>
              <div className="flex gap-1">
                {activeCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
                    <RotateCcw className="mr-1 h-3 w-3" /> Reset
                  </Button>
                )}
              </div>
            </div>

            {fields.map((field) => {
              const Icon = FIELD_ICONS[field.id] ?? field.icon;
              const value = values[field.id];
              return (
                <div key={field.id} className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {Icon && <Icon className="h-3 w-3" />}
                    {field.label}
                  </label>
                  {field.type === "search" && (
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder={`Search ${field.label.toLowerCase()}…`}
                        value={(value as string) ?? ""}
                        onChange={(e) => updateField(field.id, e.target.value || undefined)}
                        className="h-8 pl-7 text-sm"
                      />
                    </div>
                  )}
                  {field.type === "select" && field.options && (
                    <Select
                      value={(value as string) ?? ""}
                      onValueChange={(v) => updateField(field.id, v === "" ? undefined : v)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={`All ${field.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All {field.label}</SelectItem>
                        {field.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}

            {onExport && (
              <Button variant="outline" size="sm" className="w-full" onClick={onExport}>
                <Download className="mr-2 h-4 w-4" /> Export filtered data
              </Button>
            )}
          </CardContent>
        </Card>
      </PopoverContent>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(values).map(([key, v]) => {
            if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
            const field = fields.find((f) => f.id === key);
            const label = typeof v === "string" ? field?.options?.find((o) => o.value === v)?.label ?? v : `${v.length} selected`;
            return (
              <Badge key={key} variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
                {field?.label}: {label}
                <button onClick={() => removeFilter(key)} className="ml-0.5 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
