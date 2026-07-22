import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Organization {
  id: string;
  name: string;
  logo: string;
  role: string;
  plan: string;
}

const ORGS: Organization[] = [
  { id: "org-1", name: "Acme Corp", logo: "AC", role: "Owner", plan: "Enterprise" },
  { id: "org-2", name: "Globex Inc", logo: "GI", role: "Admin", plan: "Business" },
  { id: "org-3", name: "Initech", logo: "IN", role: "Manager", plan: "Professional" },
  { id: "org-4", name: "Hooli", logo: "HL", role: "Viewer", plan: "Starter" },
  { id: "org-5", name: "Stark Industries", logo: "SI", role: "Admin", plan: "Enterprise" },
];

export function OrganizationSwitcher() {
  const [currentOrg, setCurrentOrg] = useState(ORGS[0]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = ORGS.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="hidden h-9 gap-2 border-border/70 bg-background/70 px-3 md:flex"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[9px] font-bold text-primary-foreground">
            {currentOrg.logo}
          </div>
          <span className="max-w-[100px] truncate text-sm font-medium">{currentOrg.name}</span>
          <Badge variant="outline" className="h-4 px-1 text-[9px]">
            {currentOrg.plan}
          </Badge>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search organizations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-64 overflow-y-auto">
          {filtered.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => {
                setCurrentOrg(org);
                setOpen(false);
              }}
              className="flex items-center gap-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground">
                {org.logo}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{org.name}</span>
                  {org.id === currentOrg.id && <Check className="h-3 w-3 text-primary" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{org.role}</span>
                  <span>·</span>
                  <span>{org.plan}</span>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
