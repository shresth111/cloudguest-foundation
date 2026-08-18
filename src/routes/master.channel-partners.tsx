import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Handshake,
  CheckCircle2,
  CalendarClock,
  AlertTriangle,
  Loader2,
  Search,
  Plus,
  Ban,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MStat,
  MSeg,
  MTag,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
  MDialog,
  MButton,
  MField,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";
import { channelPartnerService } from "@/services/channel-partner.service";
import {
  CHANNEL_PARTNER_STATUS_LABEL,
  type ChannelPartner,
  type ChannelPartnerStatus,
} from "@/types/channel-partner";

export const Route = createFileRoute("/master/channel-partners")({
  component: ChannelPartnersScreen,
});

type Filter = "all" | ChannelPartnerStatus;

const STATUS_TONE: Record<ChannelPartnerStatus, string> = {
  active: "active",
  inactive: "suspended",
};

// Mirrors the backend's app.domains.channel_partner.schemas exactly (see
// docs/channel-partner-onboarding-spec.md Section 1.2/1.3) -- client-side
// validation here is UX only, instant feedback before a round trip. The
// backend re-validates and normalizes on every request regardless; it is
// the real source of truth, never this copy.
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;
const INDIAN_MOBILE_PATTERN = /^(?:\+?91)?([6-9]\d{9})$/;

function isValidGstin(value: string): boolean {
  return GSTIN_PATTERN.test(value.trim().toUpperCase());
}

function isValidIndianMobile(value: string): boolean {
  return INDIAN_MOBILE_PATTERN.test(value.trim());
}

function hasWelcomeFailure(p: ChannelPartner): boolean {
  return !!p.welcomeSmsError || !!p.welcomeEmailError;
}

function emptyForm() {
  return { name: "", phone: "", email: "", address: "", city: "", gstNumber: "" };
}

function ChannelPartnersScreen() {
  const { can } = useAuth();
  const canCreate = can("channel_partners.create");
  const canManage = can("channel_partners.manage");

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<ChannelPartner[]>([]);
  const [selected, setSelected] = useState<ChannelPartner | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [confirmRevoke, setConfirmRevoke] = useState<ChannelPartner | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function refetch() {
    setLoading(true);
    try {
      const rows = await channelPartnerService.list();
      setPartners(rows);
    } catch {
      toast.error("Could not load channel partners from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return partners.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q) ||
        (row.email ?? "").toLowerCase().includes(q) ||
        row.city.toLowerCase().includes(q) ||
        row.gstNumber.toLowerCase().includes(q)
      );
    });
  }, [partners, filter, search]);

  const activeCount = partners.filter((p) => p.status === "active").length;
  const onboardedThisMonth = useMemo(() => {
    const now = new Date();
    return partners.filter((p) => {
      const created = new Date(p.createdAt);
      return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }).length;
  }, [partners]);
  const welcomeFailureCount = partners.filter(hasWelcomeFailure).length;

  function resetForm() {
    setForm(emptyForm());
    setErrors({});
  }

  function updateField(patch: Partial<ReturnType<typeof emptyForm>>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function validateForm(): Record<string, string> {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) {
      next.name = "Enter the partner's full name.";
    }
    if (!isValidIndianMobile(form.phone)) {
      next.phone = "Enter a valid 10-digit Indian mobile number, e.g. 9876543210.";
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (form.address.trim().length < 5) {
      next.address = "Enter the partner's business address.";
    }
    if (!form.city.trim()) {
      next.city = "Enter the partner's city.";
    }
    if (!isValidGstin(form.gstNumber)) {
      next.gstNumber = "Enter a valid 15-character GSTIN, e.g. 27AAAAA0000A1Z5.";
    }
    return next;
  }

  async function handleOnboard() {
    const validation = validateForm();
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast.error("Fix the highlighted fields before onboarding this partner.");
      return;
    }
    setSaving(true);
    try {
      const partner = await channelPartnerService.createAndOnboard({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim(),
        city: form.city.trim(),
        gstNumber: form.gstNumber.trim().toUpperCase(),
      });
      setPartners((prev) => [partner, ...prev]);
      setCreateOpen(false);
      resetForm();
      if (!hasWelcomeFailure(partner)) {
        const channels = partner.email
          ? `SMS sent to ${partner.phone} and email sent to ${partner.email}`
          : `welcome SMS sent to ${partner.phone}`;
        toast.success(`${partner.name} onboarded — ${channels}`);
      } else {
        const failures = [
          partner.welcomeSmsError ? `SMS: ${partner.welcomeSmsError}` : null,
          partner.welcomeEmailError ? `Email: ${partner.welcomeEmailError}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        toast.warning(`${partner.name} onboarded, but the welcome message could not be sent`, {
          description: failures || undefined,
        });
      }
    } catch (err) {
      toast.error((err as AppError).message || "Could not onboard this channel partner.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(partner: ChannelPartner) {
    setRevoking(true);
    try {
      const updated = await channelPartnerService.revoke(partner.id);
      setPartners((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
      toast.success(`${updated.name} revoked`);
      setConfirmRevoke(null);
    } catch (err) {
      toast.error((err as AppError).message || "Could not revoke this channel partner.");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <MasterShell title="Channel Partners">
      <MPageShell>
        <MSectionHeader
          eyebrow="Growth"
          title="Channel Partners"
          actions={
            canCreate && (
              <MButton variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus /> Onboard Partner
              </MButton>
            )
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MStat label="Total Partners" value={String(partners.length)} icon={Handshake} />
          <MStat
            label="Active"
            value={String(activeCount)}
            icon={CheckCircle2}
            accent={activeCount > 0}
          />
          <MStat
            label="Onboarded This Month"
            value={String(onboardedThisMonth)}
            icon={CalendarClock}
          />
          <MStat
            label="Welcome Message Failures"
            value={String(welcomeFailureCount)}
            icon={AlertTriangle}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <MSeg
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${M_INPUT} pl-8`}
              placeholder="Search name, phone, email, city, GST…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading channel partners…
          </div>
        ) : (
          <MTable
            head={
              <>
                <MTh>Name</MTh>
                <MTh className="hidden sm:table-cell">Phone</MTh>
                <MTh className="hidden md:table-cell">City</MTh>
                <MTh>GST Number</MTh>
                <MTh>Status</MTh>
                <MTh className="hidden md:table-cell">Onboarded</MTh>
              </>
            }
          >
            {rows.map((p) => (
              <MTr key={p.id} onClick={() => setSelected(p)}>
                <MTd>
                  <p className="font-semibold">{p.name}</p>
                  {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                </MTd>
                <MTd className="hidden text-sm sm:table-cell">{p.phone}</MTd>
                <MTd className="hidden text-sm md:table-cell">{p.city}</MTd>
                <MTd className="font-mono text-sm">{p.gstNumber}</MTd>
                <MTd>
                  <MTag
                    label={CHANNEL_PARTNER_STATUS_LABEL[p.status]}
                    tone={STATUS_TONE[p.status]}
                  />
                  {hasWelcomeFailure(p) && (
                    <span className="ml-1.5 inline-flex">
                      <MTag label="Welcome failed" tone="urgent" />
                    </span>
                  )}
                </MTd>
                <MTd className="hidden text-xs text-muted-foreground md:table-cell">
                  {new Date(p.createdAt).toLocaleString()}
                </MTd>
              </MTr>
            ))}
            {rows.length === 0 && (
              <MTr>
                <MTd className="py-10 text-center text-muted-foreground">
                  <span className="block">No channel partners match this filter.</span>
                </MTd>
              </MTr>
            )}
          </MTable>
        )}
        <p className="text-xs text-muted-foreground">
          Every partner onboarded from "Onboard Partner" appears here, whether or not the welcome
          message delivered.
        </p>

        {/* Detail drawer */}
        <MDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.name ?? ""}
          subtitle={
            selected
              ? `${selected.city} · onboarded ${new Date(selected.createdAt).toLocaleDateString()}`
              : ""
          }
          footer={
            selected &&
            canManage &&
            selected.status === "active" && (
              <MButton
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setConfirmRevoke(selected)}
              >
                <Ban /> Revoke Partner
              </MButton>
            )
          }
        >
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Phone</p>
                  <p className="mt-1 text-sm font-semibold">{selected.phone}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="mt-1 text-sm font-semibold">{selected.email ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">City</p>
                  <p className="mt-1 text-sm font-semibold">{selected.city}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="mt-1.5">
                    <MTag
                      label={CHANNEL_PARTNER_STATUS_LABEL[selected.status]}
                      tone={STATUS_TONE[selected.status]}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">Address</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{selected.address}</p>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">GSTIN</p>
                <p className="mt-1 font-mono text-sm">{selected.gstNumber}</p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Welcome Message Delivery
                </p>
                <div className="space-y-2">
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-xs",
                      selected.welcomeSmsError
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <span className="font-semibold text-foreground">SMS: </span>
                    {selected.welcomeSmsError
                      ? `Failed — ${selected.welcomeSmsError}`
                      : selected.welcomeSmsSentAt
                        ? `Sent ${new Date(selected.welcomeSmsSentAt).toLocaleString()}`
                        : "Not sent"}
                  </div>
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-xs",
                      selected.welcomeEmailError
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <span className="font-semibold text-foreground">Email: </span>
                    {selected.welcomeEmailError
                      ? `Failed — ${selected.welcomeEmailError}`
                      : selected.welcomeEmailSentAt
                        ? `Sent ${new Date(selected.welcomeEmailSentAt).toLocaleString()}`
                        : selected.email
                          ? "Not sent"
                          : "No email on file"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </MDrawer>

        {/* Create dialog */}
        <MDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Onboard Channel Partner"
          footer={
            <>
              <MButton variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </MButton>
              <MButton variant="primary" onClick={handleOnboard} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Onboarding…
                  </>
                ) : (
                  <>
                    <Handshake /> Onboard
                  </>
                )}
              </MButton>
            </>
          }
        >
          <div className="space-y-4">
            <MField label="Partner name">
              <input
                className={cn(M_INPUT, errors.name && "border-destructive")}
                placeholder="Acme Networks"
                value={form.name}
                onChange={(e) => updateField({ name: e.target.value })}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </MField>

            <div className="grid gap-4 sm:grid-cols-2">
              <MField label="Phone">
                <input
                  className={cn(M_INPUT, errors.phone && "border-destructive")}
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) => updateField({ phone: e.target.value })}
                  onBlur={(e) => updateField({ phone: e.target.value.trim() })}
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </MField>
              <MField label="Email (optional)">
                <input
                  type="email"
                  className={cn(M_INPUT, errors.email && "border-destructive")}
                  placeholder="partner@example.com"
                  value={form.email}
                  onChange={(e) => updateField({ email: e.target.value })}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </MField>
            </div>

            <MField label="Address">
              <textarea
                className={cn(M_INPUT, "min-h-16", errors.address && "border-destructive")}
                placeholder="Business address"
                value={form.address}
                onChange={(e) => updateField({ address: e.target.value })}
              />
              {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
            </MField>

            <div className="grid gap-4 sm:grid-cols-2">
              <MField label="City">
                <input
                  className={cn(M_INPUT, errors.city && "border-destructive")}
                  placeholder="Bengaluru"
                  value={form.city}
                  onChange={(e) => updateField({ city: e.target.value })}
                />
                {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
              </MField>
              <MField label="GST number">
                <input
                  className={cn(
                    M_INPUT,
                    "font-mono uppercase",
                    errors.gstNumber && "border-destructive",
                  )}
                  placeholder="27AAAAA0000A1Z5"
                  maxLength={15}
                  value={form.gstNumber}
                  onChange={(e) => updateField({ gstNumber: e.target.value })}
                  onBlur={(e) => updateField({ gstNumber: e.target.value.trim().toUpperCase() })}
                />
                {errors.gstNumber && <p className="text-xs text-destructive">{errors.gstNumber}</p>}
              </MField>
            </div>

            <p className="text-xs text-muted-foreground">
              Onboarding sends a welcome SMS immediately (and a welcome email too, if an email
              address is provided) — the partner is still onboarded even if that message can't be
              delivered.
            </p>
          </div>
        </MDialog>

        {/* Revoke confirmation */}
        <AlertDialog
          open={!!confirmRevoke}
          onOpenChange={(open) => !open && setConfirmRevoke(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke {confirmRevoke?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This partner will be marked inactive and can no longer be referred to as an
                onboarded Wyfy Guest channel partner. This can be reversed later by re-onboarding
                them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={revoking}
                onClick={(e) => {
                  e.preventDefault();
                  if (confirmRevoke) handleRevoke(confirmRevoke);
                }}
              >
                {revoking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Revoking…
                  </>
                ) : (
                  "Revoke Partner"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </MPageShell>
    </MasterShell>
  );
}
