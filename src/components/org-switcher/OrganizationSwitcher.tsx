import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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
import { useAuth } from "@/context/AuthContext";

interface Organization {
  id: string;
  name: string;
  logo: string;
  role: string;
  plan: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

/**
 * Bug report: "isme sab location ni aani chahiye us hi particular user ki
 * location aani chahiye" -- this rendered 5 hardcoded, entirely fake
 * companies (Acme Corp/Globex/Initech/Hooli/Stark Industries), completely
 * disconnected from the real signed-in session -- a real org owner
 * (e.g. org "xyz") saw "Acme Corp · Enterprise" here regardless. Now
 * sourced from the real session's own `organizations` (AuthContext, from
 * the login response's real membership list) -- never any organization
 * the signed-in user doesn't actually belong to.
 *
 * There's no real cross-app "current organization" concept to switch yet
 * (every service call resolves its own org independently, see
 * ticket.service.ts's resolveOrgId doc comment) -- for the overwhelmingly
 * common one-organization-per-user case this is just an honest read-only
 * display; for the rare multi-membership account, selecting a different
 * one only updates this component's own local highlight, it doesn't yet
 * re-scope the rest of the app. Hidden entirely for a session with no
 * organization memberships at all (a Master console operator, global
 * scope) -- nothing real to show, so nothing fake is shown either.
 */
export function OrganizationSwitcher() {
  const { organizations, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const orgs = useMemo<Organization[]>(
    () =>
      organizations.map((m) => ({
        id: m.organizationId,
        name: m.organizationName,
        logo: initials(m.organizationName),
        role:
          roles.find((r) => r.organizationId === m.organizationId)?.roleName ??
          (m.isPrimaryContact ? "Primary contact" : "Member"),
        plan: m.enabledFeatures.includes("white_label") ? "Enterprise" : "Standard",
      })),
    [organizations, roles],
  );

  const [currentOrgId, setCurrentOrgId] = useState<string | undefined>(orgs[0]?.id);
  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? orgs[0];

  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  if (!currentOrg) return null;

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
                setCurrentOrgId(org.id);
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
