import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Star,
  MapPin,
  Building2,
  ArrowRight,
  Clock,
  ShieldCheck,
  Shield,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { primaryRoleLabel } from "@/lib/roles";
import type { SiteType } from "@/types/location";
import type { LucideIcon } from "lucide-react";

const ACTIVE_LOC_KEY = "cg.workspace.activeLoc";
const FAV_KEY = "cg.spaces.favorites";
const RECENT_KEY = "cg.spaces.recent";

type Tier = "platform" | "organization" | "location";

interface SpaceCard {
  id: string;
  tier: Tier;
  title: string;
  subtitle: string;
  city?: string;
  siteType?: SiteType;
  organizationId?: string;
  memberCount?: number;
  gradient: string;
}

interface BackendLocation {
  id: string;
  name: string;
  city: string;
  property_type: string | null;
}

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  hotel: "Hotels",
  resort: "Resorts",
  cafe: "Cafes",
  restaurant: "Restaurants",
  hospital: "Hospitals",
  clinic: "Clinics",
  office: "Corporates",
  coworking_space: "Coworking",
  school: "Schools",
  college: "Colleges",
  university: "Universities",
  mall: "Malls",
  airport: "Airports",
};

function readList(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as string[];
  } catch {
    return [];
  }
}
function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* ignore */
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return h;
}

const GRADIENTS = [
  "from-indigo-500/15 via-blue-500/10 to-transparent",
  "from-emerald-500/15 via-teal-500/10 to-transparent",
  "from-amber-500/15 via-orange-500/10 to-transparent",
  "from-fuchsia-500/15 via-purple-500/10 to-transparent",
  "from-sky-500/15 via-cyan-500/10 to-transparent",
  "from-rose-500/15 via-pink-500/10 to-transparent",
];

function pickGradient(seed: string): string {
  return GRADIENTS[hash(seed) % GRADIENTS.length];
}

export const Route = createFileRoute("/_authenticated/select-space")({
  component: SelectSpacePage,
});

const TIER_META: Record<Tier, { label: string; icon: LucideIcon; tone: string }> = {
  platform: { label: "Platform", icon: Shield, tone: "text-primary" },
  organization: { label: "Organization", icon: Building2, tone: "text-amber-600 dark:text-amber-400" },
  location: { label: "Location", icon: MapPin, tone: "text-sky-600 dark:text-sky-400" },
};

function SelectSpacePage() {
  const { user, roles, organizations } = useAuth();
  const navigate = useNavigate();

  const isPlatformUser = roles.some((r) => r.scopeType === "global");

  const { data: platformOrgCount } = useQuery({
    queryKey: ["select-space", "platform-org-count"],
    queryFn: async () => {
      const { data } = await api.get<{ total_items: number }>("/organizations", {
        params: { page_size: 1 },
      });
      return data.total_items;
    },
    enabled: isPlatformUser,
  });

  const locationQueries = useQueries({
    queries: organizations.map((org) => ({
      queryKey: ["select-space", "locations", org.organizationId],
      queryFn: async () => {
        const { data } = await api.get<{ items: BackendLocation[] }>(
          `/organizations/${org.organizationId}/locations`,
          { params: { page_size: 100 }, headers: { "X-Organization-Id": org.organizationId } },
        );
        return data.items;
      },
    })),
  });

  const isLoading = locationQueries.some((q) => q.isLoading);
  const locationsByOrg = useMemo(() => {
    const map = new Map<string, BackendLocation[]>();
    organizations.forEach((org, i) => {
      map.set(org.organizationId, locationQueries[i]?.data ?? []);
    });
    return map;
  }, [organizations, locationQueries]);

  const [favorites, setFavorites] = useState<string[]>(() => readList(FAV_KEY));
  const [recent, setRecent] = useState<string[]>(() => readList(RECENT_KEY));
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");
  const [spaceTypeFilter, setSpaceTypeFilter] = useState<string>("all");

  const allCards = useMemo<SpaceCard[]>(() => {
    const cards: SpaceCard[] = [];

    if (isPlatformUser) {
      cards.push({
        id: "platform",
        tier: "platform",
        title: "Platform Administration",
        subtitle: "Manage every organization, subscription and system service.",
        memberCount: platformOrgCount,
        gradient: "from-primary/25 via-primary/10 to-transparent",
      });
    }

    for (const org of organizations) {
      const locs = locationsByOrg.get(org.organizationId) ?? [];
      cards.push({
        id: `org:${org.organizationId}`,
        tier: "organization",
        title: org.organizationName,
        subtitle: "Organization workspace",
        organizationId: org.organizationId,
        memberCount: locs.length,
        gradient: pickGradient(org.organizationId),
      });
      for (const loc of locs) {
        cards.push({
          id: loc.id,
          tier: "location",
          title: loc.name,
          subtitle: org.organizationName,
          city: loc.city,
          siteType: (loc.property_type as SiteType) ?? undefined,
          organizationId: org.organizationId,
          gradient: pickGradient(loc.id),
        });
      }
    }

    return cards;
  }, [isPlatformUser, platformOrgCount, organizations, locationsByOrg]);

  const spaceTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const org of organizations) {
      for (const loc of locationsByOrg.get(org.organizationId) ?? []) {
        if (loc.property_type) seen.add(loc.property_type);
      }
    }
    return Array.from(seen);
  }, [organizations, locationsByOrg]);

  // Skip the picker silently when there's exactly one organization with
  // exactly one location and no elevated platform access to choose instead.
  useEffect(() => {
    if (isLoading || isPlatformUser) return;
    if (organizations.length !== 1) return;
    const onlyOrgLocations = locationsByOrg.get(organizations[0].organizationId) ?? [];
    if (onlyOrgLocations.length !== 1) return;
    try {
      localStorage.setItem(ACTIVE_LOC_KEY, onlyOrgLocations[0].id);
    } catch {
      /* ignore */
    }
    navigate({ to: "/workspace", replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isPlatformUser, organizations, locationsByOrg]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCards.filter((c) => {
      if (tierFilter !== "all" && c.tier !== tierFilter) return false;
      if (spaceTypeFilter !== "all" && c.tier === "location" && c.siteType !== spaceTypeFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        (c.city?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [allCards, query, tierFilter, spaceTypeFilter]);

  const favoriteCards = filtered.filter((c) => favorites.includes(c.id));
  const recentCards = filtered
    .filter((c) => recent.includes(c.id) && !favorites.includes(c.id))
    .sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id))
    .slice(0, 4);

  const tiersInOrder: Tier[] = ["platform", "organization", "location"];
  const otherByTier = tiersInOrder
    .map((tier) => ({
      tier,
      cards: filtered.filter(
        (c) => c.tier === tier && !favorites.includes(c.id) && !recentCards.includes(c),
      ),
    }))
    .filter((g) => g.cards.length > 0);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [id, ...favorites];
    setFavorites(next);
    writeList(FAV_KEY, next);
  }

  function selectSpace(card: SpaceCard) {
    const nextRecent = [card.id, ...recent.filter((r) => r !== card.id)].slice(0, 6);
    setRecent(nextRecent);
    writeList(RECENT_KEY, nextRecent);

    if (card.tier === "platform") {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    if (card.tier === "organization") {
      navigate({ to: "/organizations", replace: true });
      return;
    }
    // location
    try {
      localStorage.setItem(ACTIVE_LOC_KEY, card.id);
    } catch { /* ignore */ }
    navigate({ to: "/workspace", replace: true });
  }

  const greeting = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5" />
          Signed in as {user?.name} · {primaryRoleLabel(roles)}
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {greeting}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose where you want to work. You can switch spaces anytime from the top bar.
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search platforms, organizations, locations…"
            className="pl-9 h-11"
          />
        </div>
        <Tabs value={tierFilter} onValueChange={(v) => setTierFilter(v as "all" | Tier)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {isPlatformUser && <TabsTrigger value="platform">Platform</TabsTrigger>}
            <TabsTrigger value="organization">Organizations</TabsTrigger>
            <TabsTrigger value="location">Locations</TabsTrigger>
          </TabsList>
        </Tabs>
        {spaceTypes.length > 0 && (
          <Select value={spaceTypeFilter} onValueChange={setSpaceTypeFilter}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="Space type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All space types</SelectItem>
              {spaceTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {PROPERTY_TYPE_LABEL[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-56 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : allCards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No spaces are assigned to your account yet. Contact your administrator.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {favoriteCards.length > 0 && (
            <Section title="Favorites" icon={Star} cards={favoriteCards} favorites={favorites} onSelect={selectSpace} onFav={toggleFavorite} />
          )}
          {recentCards.length > 0 && (
            <Section title="Recent" icon={Clock} cards={recentCards} favorites={favorites} onSelect={selectSpace} onFav={toggleFavorite} />
          )}
          {otherByTier.map(({ tier, cards }) => (
            <Section
              key={tier}
              title={`${TIER_META[tier].label} workspaces`}
              icon={TIER_META[tier].icon}
              cards={cards}
              favorites={favorites}
              onSelect={selectSpace}
              onFav={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  cards,
  favorites,
  onSelect,
  onFav,
}: {
  title: string;
  icon: LucideIcon;
  cards: SpaceCard[];
  favorites: string[];
  onSelect: (c: SpaceCard) => void;
  onFav: (id: string) => void;
}) {
  if (cards.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" /> {title}
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">{cards.length}</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <SpaceTile key={c.id} card={c} isFav={favorites.includes(c.id)} onSelect={onSelect} onFav={onFav} />
        ))}
      </div>
    </section>
  );
}

function SpaceTile({
  card,
  isFav,
  onSelect,
  onFav,
}: {
  card: SpaceCard;
  isFav: boolean;
  onSelect: (c: SpaceCard) => void;
  onFav: (id: string) => void;
}) {
  const tier = TIER_META[card.tier];
  const TierIcon = tier.icon;

  return (
    <Card className="group relative overflow-hidden border-border/60 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_40px_-20px_oklch(0.52_0.18_265/0.35)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-70`} />
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${tier.tone}`}>
              <TierIcon className="h-3 w-3" />
              {tier.label}
            </div>
            <CardTitle className="mt-1.5 truncate text-lg">{card.title}</CardTitle>
            <CardDescription className="mt-0.5 truncate text-xs">
              {card.city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {card.city}
                  {card.siteType ? ` · ${PROPERTY_TYPE_LABEL[card.siteType] ?? card.siteType}` : ""}
                </span>
              ) : (
                card.subtitle
              )}
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={() => onFav(card.id)}
            aria-label={isFav ? "Remove favorite" : "Add favorite"}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Star className={isFav ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4"} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {card.memberCount !== undefined && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric icon={card.tier === "platform" ? Building2 : MapPin} label={card.tier === "platform" ? "Organizations" : "Locations"}>
              {card.memberCount}
            </Metric>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Badge variant="outline">{tier.label}</Badge>
        </div>
        <Button className="w-full" onClick={() => onSelect(card)}>
          Enter workspace
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-2 backdrop-blur">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{children}</div>
    </div>
  );
}
