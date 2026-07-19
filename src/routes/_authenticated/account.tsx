import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  Bell,
  Building2,
  Check,
  Clock,
  Copy,
  KeyRound,
  KeySquare,
  Loader2,
  Monitor,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCog,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { ROLE_BADGE_VARIANT, ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

const SECTION_KEYS = [
  "profile",
  "company",
  "account",
  "preferences",
  "security",
  "password",
  "two-factor",
  "sessions",
  "history",
  "notifications",
  "api-tokens",
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const searchSchema = z.object({
  section: z.enum(SECTION_KEYS).optional().catch("profile"),
});

export const Route = createFileRoute("/_authenticated/account")({
  validateSearch: searchSchema,
  component: AccountPage,
});

const SECTIONS: { key: SectionKey; label: string; icon: typeof UserIcon; description: string }[] = [
  { key: "profile", label: "Profile", icon: UserIcon, description: "Public info" },
  { key: "company", label: "Company", icon: Building2, description: "Organization details" },
  { key: "account", label: "Account", icon: UserCog, description: "Localization" },
  { key: "preferences", label: "Preferences", icon: Settings2, description: "Display & density" },
  { key: "security", label: "Security", icon: ShieldCheck, description: "Overview" },
  { key: "password", label: "Password", icon: KeyRound, description: "Change password" },
  { key: "two-factor", label: "Two-factor", icon: ShieldCheck, description: "Authenticator" },
  { key: "sessions", label: "Sessions", icon: Monitor, description: "Signed-in devices" },
  { key: "history", label: "Login history", icon: Clock, description: "Recent sign-ins" },
  { key: "notifications", label: "Notifications", icon: Bell, description: "Delivery preferences" },
  { key: "api-tokens", label: "API tokens", icon: KeySquare, description: "Personal access" },
];

function AccountPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const active = (search.section ?? "profile") as SectionKey;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, security, and personal integrations.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="space-y-1">
          {SECTIONS.map((s) => {
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                onClick={() => navigate({ to: "/account", search: { section: s.key } })}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <s.icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isActive ? "text-primary" : "",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {active === "profile" && <ProfileSection />}
          {active === "company" && <CompanySection />}
          {active === "account" && <AccountSection />}
          {active === "preferences" && <PreferencesSection />}
          {active === "security" && <SecuritySection />}
          {active === "password" && <PasswordSection />}
          {active === "two-factor" && <TwoFactorSection />}
          {active === "sessions" && <SessionsSection />}
          {active === "history" && <LoginHistorySection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "api-tokens" && <ApiTokensSection />}
        </div>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function SectionCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer && <div className="flex justify-end gap-2 border-t px-6 py-4">{footer}</div>}
    </Card>
  );
}

/* ---------------- Sections ---------------- */

function ProfileSection() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [title, setTitle] = useState("Platform Administrator");
  const [phone, setPhone] = useState("+91 98200 00000");
  const [saving, setSaving] = useState(false);

  return (
    <SectionCard
      title="Profile"
      description="This information is visible to teammates in your organization."
      footer={
        <Button
          onClick={() => {
            setSaving(true);
            setTimeout(() => {
              setSaving(false);
              toast.success("Profile updated");
            }, 600);
          }}
          disabled={saving}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
        </Button>
      }
    >
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
            {user ? initials(user.name) : "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <Button variant="outline" size="sm">Upload photo</Button>
          <p className="mt-1 text-xs text-muted-foreground">JPG or PNG, up to 2 MB.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Job title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-2 pt-2">
          <span className="text-xs text-muted-foreground">Role</span>
          <Badge variant={ROLE_BADGE_VARIANT[user.role]}>{ROLE_LABELS[user.role]}</Badge>
        </div>
      )}
    </SectionCard>
  );
}

function AccountSection() {
  const [lang, setLang] = useState("en");
  const [tz, setTz] = useState("Asia/Kolkata");
  return (
    <SectionCard
      title="Account preferences"
      description="Localization and display settings for your account."
      footer={<Button onClick={() => toast.success("Preferences saved")}>Save</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Language</Label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Timezone</Label>
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option>Asia/Kolkata</option>
            <option>America/New_York</option>
            <option>Europe/London</option>
            <option>Asia/Singapore</option>
            <option>UTC</option>
          </select>
        </div>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Compact density</div>
          <div className="text-xs text-muted-foreground">Reduce padding across tables and cards.</div>
        </div>
        <Switch />
      </div>
    </SectionCard>
  );
}

function SecuritySection() {
  return (
    <div className="space-y-4">
      <SectionCard title="Security overview" description="Snapshot of your account security posture.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Password", status: "Strong", tone: "text-emerald-600" },
            { label: "Two-factor", status: "Not enabled", tone: "text-amber-600" },
            { label: "Recovery email", status: "Verified", tone: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={cn("mt-1 text-sm font-semibold", s.tone)}>{s.status}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/account" search={{ section: "password" }}>Change password</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/account" search={{ section: "two-factor" }}>Set up 2FA</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/account" search={{ section: "sessions" }}>Review sessions</Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <SectionCard
      title="Change password"
      description="Use at least 8 characters with a mix of letters, numbers and symbols."
      footer={
        <Button
          disabled={saving || !current || next.length < 8 || next !== confirm}
          onClick={() => {
            setSaving(true);
            setTimeout(() => {
              setSaving(false);
              setCurrent("");
              setNext("");
              setConfirm("");
              toast.success("Password updated");
            }, 700);
          }}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
        </Button>
      }
    >
      <div className="space-y-2">
        <Label>Current password</Label>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>New password</Label>
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Confirm new password</Label>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {confirm && next !== confirm && (
          <p className="text-xs text-destructive">Passwords do not match</p>
        )}
      </div>
    </SectionCard>
  );
}

function TwoFactorSection() {
  const [enabled, setEnabled] = useState(false);
  const [codes] = useState(() =>
    Array.from({ length: 8 }, () =>
      Math.random().toString(36).slice(2, 6).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase(),
    ),
  );
  return (
    <SectionCard
      title="Two-factor authentication"
      description="Protect your account with a time-based one-time password."
    >
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <div className="text-sm font-medium">Authenticator app</div>
          <div className="text-xs text-muted-foreground">
            {enabled ? "Enabled · using CloudGuest Authenticator" : "Not enabled"}
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            setEnabled(v);
            toast.success(v ? "Two-factor enabled" : "Two-factor disabled");
          }}
        />
      </div>
      {enabled && (
        <div className="rounded-lg border p-4">
          <div className="mb-2 text-sm font-medium">Backup codes</div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
            {codes.map((c) => (
              <div key={c} className="rounded bg-muted px-2 py-1.5 text-center">{c}</div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Store these codes somewhere safe. Each code works once.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function SessionsSection() {
  const [sessions, setSessions] = useState([
    { id: "s1", device: "MacBook Pro · Chrome", ip: "203.0.113.24", city: "Bengaluru", current: true, when: "Active now" },
    { id: "s2", device: "iPhone 15 · Safari", ip: "203.0.113.88", city: "Bengaluru", current: false, when: "2h ago" },
    { id: "s3", device: "Windows · Firefox", ip: "198.51.100.14", city: "Delhi", current: false, when: "Yesterday" },
  ]);
  return (
    <SectionCard title="Active sessions" description="Devices currently signed in to your account.">
      <ul className="divide-y">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                {s.device}
                {s.current && <Badge variant="secondary">This device</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.city} · {s.ip} · {s.when}
              </div>
            </div>
            {!s.current && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSessions((x) => x.filter((v) => v.id !== s.id));
                  toast.success("Session revoked");
                }}
              >
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSessions((x) => x.filter((v) => v.current));
          toast.success("All other sessions signed out");
        }}
      >
        Sign out all other sessions
      </Button>
    </SectionCard>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState({
    productEmail: true,
    securityEmail: true,
    weeklyDigest: false,
    smsCritical: true,
    inApp: true,
  });
  const toggle = (k: keyof typeof prefs) => (v: boolean) => setPrefs((p) => ({ ...p, [k]: v }));
  const rows: { key: keyof typeof prefs; label: string; hint: string }[] = [
    { key: "productEmail", label: "Product updates", hint: "New features and release notes" },
    { key: "securityEmail", label: "Security alerts", hint: "Sign-ins, key rotations, critical events" },
    { key: "weeklyDigest", label: "Weekly digest", hint: "Summary of usage every Monday" },
    { key: "smsCritical", label: "Critical SMS", hint: "SMS for outages and revoked access" },
    { key: "inApp", label: "In-app notifications", hint: "Show in the notification bell" },
  ];
  return (
    <SectionCard
      title="Notification preferences"
      description="Choose how CloudGuest reaches you."
      footer={<Button onClick={() => toast.success("Preferences saved")}>Save</Button>}
    >
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{r.label}</div>
            <div className="text-xs text-muted-foreground">{r.hint}</div>
          </div>
          <Switch checked={prefs[r.key]} onCheckedChange={toggle(r.key)} />
        </div>
      ))}
    </SectionCard>
  );
}

function ApiTokensSection() {
  const [tokens, setTokens] = useState([
    { id: "t1", name: "CI pipeline", created: "2 weeks ago", lastUsed: "3h ago" },
    { id: "t2", name: "Reporting script", created: "Jan 12, 2026", lastUsed: "Yesterday" },
  ]);
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  return (
    <SectionCard
      title="Personal API tokens"
      description="Programmatic access to the CloudGuest API using your permissions."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Token name (e.g. Grafana exporter)"
        />
        <Button
          onClick={() => {
            if (!name.trim()) return;
            const tok =
              "cg_pat_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
            setTokens((x) => [{ id: tok.slice(0, 8), name, created: "Just now", lastUsed: "—" }, ...x]);
            setNewToken(tok);
            setName("");
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Create token
        </Button>
      </div>

      {newToken && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="text-xs font-medium">Copy your token now — it won't be shown again.</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{newToken}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(newToken).catch(() => {});
                toast.success("Token copied");
              }}
            >
              <Copy className="mr-2 h-3.5 w-3.5" /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNewToken(null)}>
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ul className="divide-y">
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                Created {t.created} · Last used {t.lastUsed}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTokens((x) => x.filter((v) => v.id !== t.id));
                toast.success("Token revoked");
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function CompanySection() {
  const [name, setName] = useState("Nimbus Hospitality");
  const [domain, setDomain] = useState("nimbus.example.com");
  const [industry, setIndustry] = useState("Hospitality");
  const [size, setSize] = useState("501-1000");
  return (
    <SectionCard
      title="Company"
      description="Details visible to teammates and shared across the workspace."
      footer={<Button onClick={() => toast.success("Company details saved")}>Save changes</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Company name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Primary domain</Label>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Company size</Label>
          <Input value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
      </div>
    </SectionCard>
  );
}

function PreferencesSection() {
  const [density, setDensity] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const rows: { key: string; label: string; hint: string; value: boolean; onChange: (v: boolean) => void }[] = [
    { key: "density", label: "Compact density", hint: "Reduce padding across tables and cards.", value: density, onChange: setDensity },
    { key: "motion", label: "Reduce motion", hint: "Minimize animations and transitions.", value: reduceMotion, onChange: setReduceMotion },
    { key: "contrast", label: "High contrast", hint: "Boost contrast for improved legibility.", value: highContrast, onChange: setHighContrast },
  ];
  return (
    <SectionCard
      title="Display preferences"
      description="Personalize how CloudGuest looks and feels for your account."
      footer={<Button onClick={() => toast.success("Preferences saved")}>Save</Button>}
    >
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{r.label}</div>
            <div className="text-xs text-muted-foreground">{r.hint}</div>
          </div>
          <Switch checked={r.value} onCheckedChange={r.onChange} />
        </div>
      ))}
    </SectionCard>
  );
}

function LoginHistorySection() {
  const events = [
    { when: "Just now", device: "MacBook Pro · Chrome", ip: "203.0.113.24", city: "Bengaluru", outcome: "success" },
    { when: "2h ago", device: "iPhone 15 · Safari", ip: "203.0.113.88", city: "Bengaluru", outcome: "success" },
    { when: "Yesterday, 09:12", device: "Windows · Firefox", ip: "198.51.100.14", city: "Delhi", outcome: "success" },
    { when: "Jul 12, 22:41", device: "Unknown · curl", ip: "45.9.13.71", city: "Amsterdam", outcome: "failed" },
    { when: "Jul 09, 18:07", device: "iPad · Safari", ip: "203.0.113.90", city: "Bengaluru", outcome: "success" },
  ];
  return (
    <SectionCard title="Login history" description="Recent sign-in attempts on your account.">
      <ul className="divide-y">
        {events.map((e, i) => (
          <li key={i} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{e.device}</div>
              <div className="text-xs text-muted-foreground">
                {e.city} · {e.ip} · {e.when}
              </div>
            </div>
            <Badge variant={e.outcome === "success" ? "secondary" : "destructive"}>
              {e.outcome === "success" ? "Success" : "Failed"}
            </Badge>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

