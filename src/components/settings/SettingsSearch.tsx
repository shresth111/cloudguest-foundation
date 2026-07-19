import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SettingsSearchProps {
  value: string;
  onChange: (v: string) => void;
}
export function SettingsSearch({ value, onChange }: SettingsSearchProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search settings…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-8"
      />
    </div>
  );
}
