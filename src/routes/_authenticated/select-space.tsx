import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Star,
  Wifi,
  MapPin,
  Users,
  Activity,
  Building2,
  ArrowRight,
  Clock,
  ShieldCheck,
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
import { customerService, type ExistingCustomer } from "@/services/customer.service";
import { customerKeys } from "@/hooks/useCustomer";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABELS } from "@/lib/roles";

const ACTIVE_LOC_KEY = "cg.workspace.activeLoc";
const FAV_KEY = "cg.spaces.favorites";
const RECENT_KEY = "cg.spaces.recent";

interface SpaceCard {
  id: string;
  locationName: string;
  city: string;
  siteType: string;
  customerId: string;
  customerName: string;
  organizationName: string;
  subscription: ExistingCustomer["subscription"];
  routerStatus: "online" | "degraded" | "offline";
  deviceCount: number;
  onlineUsers: number;
  lastSyncMinutes: number;
}

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

function buildCards(customers: ExistingCustomer[], forEmail?: string): SpaceCard[] {
  const email = forEmail?.toLowerCase();
  const scoped = email
    ? customers.filter((c) => c.owner.email.toLowerCase() === email)
    : customers;
  const source = scoped.length ? scoped : customers;
  const cards: SpaceCard[] = [];
  for (const c of source) {
    for (const l of c.locations) {
      const h = hash(l.id);
      const statuses = ["online", "online", "online", "degraded", "offline"] as const;
      cards.push({
        id: l.id,
        locationName: l.name,
        city: l.city,
        siteType: l.siteType,
        customerId: c.id,
        customerName: c.name,
        organizationName: c.organizationName,
        subscription: c.subscription,
        routerStatus: statuses[h % statuses.length],
        deviceCount: 6 + (h % 42),
        onlineUsers: 5 + (h % 180),
        lastSyncMinutes: h % 32,
      });
    }
  }
  return cards;
}

export const Route = createFileRoute("/_authenticated/select-space")({
  component: SelectSpacePage,
});

function SelectSpacePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: customers, isLoading } = useQuery({
    queryKey: customerKeys.list,
    queryFn: () => customerService.listCustomers(),
  });

  const [favorites, setFavorites] = useState<string[]>(() => readList(FAV_KEY));
  const [recent, setRecent] = useState<string[]>(() => readList(RECENT_KEY));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const allCards = useMemo(
    () => (customers ? buildCards(customers, user?.email) : []),
    [customers, user?.email],
  );

  // Auto-select if only one card
  useEffect(() => {
    if (isLoading || !customers) return;
    if (allCards.length === 1) {
      selectSpace(allCards[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, allCards.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCards.filter((c) => {
      if (statusFilter !== "all" && c.routerStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        c.locationName.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.organizationName.toLowerCase().includes(q)
      );
    });
  }, [allCards, query, statusFilter]);

  const favoriteCards = filtered.filter((c) => favorites.includes(c.id));
  const recentCards = filtered
    .filter((c) => recent.includes(c.id) && !favorites.includes(c.id))
    .sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id))
    .slice(0, 4);
  const otherCards = filtered.filter(
    (c) => !favorites.includes(c.id) && !recentCards.includes(c),
  );

  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [id, ...favorites];
    setFavorites(next);
    writeList(FAV_KEY, next);
  }

  function selectSpace(card: SpaceCard) {
    try {
      localStorage.setItem(ACTIVE_LOC_KEY, card.id);
    } catch {
      /* ignore */
    }
    const nextRecent = [card.id, ...recent.filter((r) => r !== card.id)].slice(0, 6);
    setRecent(nextRecent);
    writeList(RECENT_KEY, nextRecent);
    navigate({ to: "/workspace", replace: true });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Signed in as {user?.name} · {user ? ROLE_LABELS[user.role] : ""}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Select your space</h1>
        <p className="text-sm text-muted-foreground">
          Choose the location you want to manage. You can switch spaces anytime from the top bar.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by location, city, business…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Router status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="degraded">Degraded</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : allCards.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No spaces are assigned to your account yet. Contact your administrator.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {favoriteCards.length > 0 && (
            <Section title="Favorites" icon={Star} cards={favoriteCards} favorites={favorites} onSelect={selectSpace} onFav={toggleFavorite} />
          )}
          {recentCards.length > 0 && (
            <Section title="Recent" icon={Clock} cards={recentCards} favorites={favorites} onSelect={selectSpace} onFav={toggleFavorite} />
          )}
          <Section
            title={favoriteCards.length || recentCards.length ? "All spaces" : "Available spaces"}
            icon={Building2}
            cards={otherCards}
            favorites={favorites}
            onSelect={selectSpace}
            onFav={toggleFavorite}
          />
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
  icon: typeof Star;
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
  const statusDot =
    card.routerStatus === "online"
      ? "bg-emerald-500"
      : card.routerStatus === "degraded"
        ? "bg-amber-500"
        : "bg-rose-500";
  const subLabel =
    card.subscription.status === "active"
      ? "Active"
      : card.subscription.status === "trial"
        ? "Trial"
        : "Expired";
  const subVariant: "default" | "secondary" | "destructive" =
    card.subscription.status === "expired"
      ? "destructive"
      : card.subscription.status === "trial"
        ? "secondary"
        : "default";

  return (
    <Card className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardDescription className="truncate text-xs font-medium uppercase tracking-wide">
              {card.customerName}
            </CardDescription>
            <CardTitle className="mt-1 truncate text-lg">{card.locationName}</CardTitle>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {card.city} · {card.siteType}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFav(card.id)}
            aria-label={isFav ? "Remove favorite" : "Add favorite"}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Star className={isFav ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4"} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Metric icon={Wifi} label="Router">
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              <span className="capitalize">{card.routerStatus}</span>
            </span>
          </Metric>
          <Metric icon={Activity} label="Devices">{card.deviceCount}</Metric>
          <Metric icon={Users} label="Online">{card.onlineUsers}</Metric>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant={subVariant}>{subLabel}</Badge>
          <span className="text-xs text-muted-foreground">
            Synced {card.lastSyncMinutes === 0 ? "just now" : `${card.lastSyncMinutes}m ago`}
          </span>
        </div>
        <Button className="w-full" onClick={() => onSelect(card)}>
          Enter workspace
          <ArrowRight className="ml-2 h-4 w-4" />
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
  icon: typeof Star;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{children}</div>
    </div>
  );
}
