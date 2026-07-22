import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { primaryRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui-ext";
import { authService } from "@/services/auth.service";
import { rbacService } from "@/services/rbac.service";
import type { AppError } from "@/services/api";
import {
  changePasswordSchema,
  mfaDisableSchema,
  mfaRegenerateSchema,
  mfaVerifySchema,
  type ChangePasswordFormValues,
  type MfaDisableFormValues,
  type MfaRegenerateFormValues,
  type MfaVerifyFormValues,
} from "@/lib/rbac-schemas";

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
      <SectionHeader
        eyebrow="Personal settings"
        title="Account"
        description="Manage your profile, security, and personal integrations."
      />

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
                <s.icon className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
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
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
    <Card className="rounded-2xl border-border/70 shadow-sm transition-all duration-200 hover:shadow-md">
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
  const { user, roles } = useAuth();
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
          <Button variant="outline" size="sm">
            Upload photo
          </Button>
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
          <Badge variant="secondary">{primaryRoleLabel(roles)}</Badge>
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
          <div className="text-xs text-muted-foreground">
            Reduce padding across tables and cards.
          </div>
        </div>
        <Switch />
      </div>
    </SectionCard>
  );
}

function SecuritySection() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <SectionCard
        title="Security overview"
        description="Snapshot of your account security posture."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Email verified</div>
            <div
              className={cn(
                "mt-1 text-sm font-semibold",
                user?.isVerified ? "text-emerald-600" : "text-amber-600",
              )}
            >
              {user?.isVerified ? "Verified" : "Not verified"}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Last login</div>
            <div className="mt-1 text-sm font-semibold">
              {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Account status</div>
            <div
              className={cn(
                "mt-1 text-sm font-semibold",
                user?.isActive ? "text-emerald-600" : "text-amber-600",
              )}
            >
              {user?.isActive ? "Active" : "Inactive"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/account" search={{ section: "password" }}>
              Change password
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/account" search={{ section: "two-factor" }}>
              Two-factor authentication
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/account" search={{ section: "sessions" }}>
              Review sessions
            </Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

function PasswordSection() {
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const change = useMutation({
    mutationFn: (v: ChangePasswordFormValues) =>
      authService.changePassword(v.currentPassword, v.newPassword),
    onSuccess: () => {
      toast.success("Password updated. You've been signed out of all other sessions.");
      form.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (e) => toast.error((e as unknown as AppError).message || "Failed to change password"),
  });

  return (
    <SectionCard
      title="Change password"
      description="Must be at least 12 characters with uppercase, lowercase, a digit, and a symbol."
      footer={
        <Button onClick={form.handleSubmit((v) => change.mutate(v))} disabled={change.isPending}>
          {change.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
        </Button>
      }
    >
      <div className="space-y-2">
        <Label>Current password</Label>
        <Input type="password" {...form.register("currentPassword")} />
        {form.formState.errors.currentPassword && (
          <p className="text-xs text-destructive">
            {form.formState.errors.currentPassword.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label>New password</Label>
        <Input type="password" {...form.register("newPassword")} />
        {form.formState.errors.newPassword && (
          <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Confirm new password</Label>
        <Input type="password" {...form.register("confirmPassword")} />
        {form.formState.errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function TwoFactorSection() {
  const [enrollment, setEnrollment] = useState<{ secret: string; provisioningUri: string } | null>(
    null,
  );
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const enroll = useMutation({
    mutationFn: () => authService.enrollMfa(),
    onSuccess: (res) => {
      setEnrollment(res);
      setRecoveryCodes(null);
    },
    onError: (e) => toast.error((e as unknown as AppError).message || "Failed to start enrollment"),
  });

  const verifyForm = useForm<MfaVerifyFormValues>({
    resolver: zodResolver(mfaVerifySchema),
    defaultValues: { code: "" },
  });
  const verify = useMutation({
    mutationFn: (v: MfaVerifyFormValues) => authService.verifyMfa(v.code),
    onSuccess: (codes) => {
      setRecoveryCodes(codes);
      setEnrollment(null);
      verifyForm.reset({ code: "" });
      toast.success("Two-factor authentication enabled");
    },
    onError: (e) => toast.error((e as unknown as AppError).message || "Invalid code"),
  });

  const disableForm = useForm<MfaDisableFormValues>({
    resolver: zodResolver(mfaDisableSchema),
    defaultValues: { password: "", code: "" },
  });
  const disable = useMutation({
    mutationFn: (v: MfaDisableFormValues) => authService.disableMfa(v.password, v.code),
    onSuccess: () => {
      toast.success("Two-factor authentication disabled");
      disableForm.reset({ password: "", code: "" });
    },
    onError: (e) => toast.error((e as unknown as AppError).message || "Failed to disable"),
  });

  const regenForm = useForm<MfaRegenerateFormValues>({
    resolver: zodResolver(mfaRegenerateSchema),
    defaultValues: { code: "" },
  });
  const regenerate = useMutation({
    mutationFn: (v: MfaRegenerateFormValues) => authService.regenerateMfaRecoveryCodes(v.code),
    onSuccess: (codes) => {
      setRecoveryCodes(codes);
      regenForm.reset({ code: "" });
      toast.success("New recovery codes generated");
    },
    onError: (e) => toast.error((e as unknown as AppError).message || "Failed to regenerate codes"),
  });

  return (
    <div className="space-y-4">
      <SectionCard
        title="Authenticator app (TOTP)"
        description="Add a time-based one-time password from an app like Google Authenticator, Authy, or 1Password."
      >
        {!enrollment ? (
          <Button variant="outline" onClick={() => enroll.mutate()} disabled={enroll.isPending}>
            {enroll.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Set up
            authenticator app
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="rounded-lg bg-white p-2">
                <QRCodeSVG value={enrollment.provisioningUri} size={140} />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Scan this QR code, or enter the secret manually:
                </p>
                <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
                  {enrollment.secret}
                </code>
              </div>
            </div>
            <form
              onSubmit={verifyForm.handleSubmit((v) => verify.mutate(v))}
              className="flex flex-wrap items-end gap-2"
            >
              <div className="space-y-1.5">
                <Label>Enter the 6-digit code</Label>
                <Input className="w-32" maxLength={6} {...verifyForm.register("code")} />
                {verifyForm.formState.errors.code && (
                  <p className="text-xs text-destructive">
                    {verifyForm.formState.errors.code.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={verify.isPending}>
                {verify.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify &amp;
                enable
              </Button>
            </form>
          </div>
        )}
      </SectionCard>

      {recoveryCodes && (
        <SectionCard
          title="Recovery codes"
          description="Store these somewhere safe — shown once, each code works once."
        >
          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
            {recoveryCodes.map((c) => (
              <div key={c} className="rounded bg-muted px-2 py-1.5 text-center">
                {c}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Disable two-factor"
        description="Requires your password and a current code or recovery code."
      >
        <form
          onSubmit={disableForm.handleSubmit((v) => disable.mutate(v))}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" {...disableForm.register("password")} />
          </div>
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input {...disableForm.register("code")} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="destructive" disabled={disable.isPending}>
              {disable.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Disable
              two-factor
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Regenerate recovery codes"
        description="Invalidates all existing recovery codes."
      >
        <form
          onSubmit={regenForm.handleSubmit((v) => regenerate.mutate(v))}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="space-y-1.5">
            <Label>Current code</Label>
            <Input className="w-32" {...regenForm.register("code")} />
          </div>
          <Button type="submit" variant="outline" disabled={regenerate.isPending}>
            {regenerate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Regenerate
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}

function SessionsSection() {
  const qc = useQueryClient();
  const {
    data: sessions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: () => authService.listSessions(),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => authService.revokeSession(id),
    onSuccess: () => {
      toast.success("Session revoked");
      qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (e) => toast.error((e as unknown as AppError).message || "Failed to revoke session"),
  });
  const revokeAll = useMutation({
    mutationFn: () => authService.logoutAllSessions(),
    onSuccess: () => {
      toast.success("All other sessions signed out");
      qc.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (e) =>
      toast.error((e as unknown as AppError).message || "Failed to sign out sessions"),
  });

  return (
    <SectionCard title="Active sessions" description="Devices currently signed in to your account.">
      {isError ? (
        <p className="text-sm text-destructive">Failed to load sessions.</p>
      ) : isLoading || !sessions ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {s.deviceName || "Unknown device"}
                  {s.isCurrent && <Badge variant="secondary">This device</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.ipAddress} · {s.location ?? "—"} · last active{" "}
                  {new Date(s.lastActivityAt).toLocaleString()}
                </div>
                <div className="truncate text-xs text-muted-foreground">{s.userAgent}</div>
              </div>
              {!s.isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(s.id)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={revokeAll.isPending}
        onClick={() => revokeAll.mutate()}
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
    {
      key: "securityEmail",
      label: "Security alerts",
      hint: "Sign-ins, key rotations, critical events",
    },
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
            setTokens((x) => [
              { id: tok.slice(0, 8), name, created: "Just now", lastUsed: "—" },
              ...x,
            ]);
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
            <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">
              {newToken}
            </code>
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
  const rows: {
    key: string;
    label: string;
    hint: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }[] = [
    {
      key: "density",
      label: "Compact density",
      hint: "Reduce padding across tables and cards.",
      value: density,
      onChange: setDensity,
    },
    {
      key: "motion",
      label: "Reduce motion",
      hint: "Minimize animations and transitions.",
      value: reduceMotion,
      onChange: setReduceMotion,
    },
    {
      key: "contrast",
      label: "High contrast",
      hint: "Boost contrast for improved legibility.",
      value: highContrast,
      onChange: setHighContrast,
    },
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
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["auth", "login-history", user?.email],
    queryFn: () => rbacService.listLoginAttempts({ email: user!.email, page: 1, pageSize: 25 }),
    enabled: !!user?.email,
  });

  return (
    <SectionCard title="Login history" description="Recent sign-in attempts on your account.">
      {isError ? (
        <p className="text-sm text-destructive">
          Failed to load login history (this view requires audit-log read access).
        </p>
      ) : isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent login attempts.</p>
      ) : (
        <ul className="divide-y">
          {data.items.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {e.userAgent ?? "Unknown device"}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {e.ipAddress} · {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
              <Badge variant={e.success ? "secondary" : "destructive"}>
                {e.success ? "Success" : (e.failureReason ?? "Failed")}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
