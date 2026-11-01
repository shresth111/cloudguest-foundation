import { useEffect, useState, type ReactNode } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Loader2, Pause, Play, Save, UserPlus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { MButton, MDrawer, MField, MTag, M_INPUT } from "@/components/master/MasterKit";
import { TemporaryPasswordPanel } from "@/components/master/isp-partners/TemporaryPasswordPanel";
import { IspParityPanel } from "@/components/master/isp-partners/IspParityPanel";
import { requestErrorOf } from "@/services/api";
import {
  ispPartnerPlatformService,
  type IspOwnerCredential,
  type IspPartner,
} from "@/services/isp-partner/platform";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Pending =
  | { kind: "suspend" }
  | { kind: "activate" }
  | { kind: "reset"; userId: string; name: string }
  | null;

/**
 * One ISP partner: profile, counts, suspend/activate, add an owner, reset an
 * owner's password. Confirmations use the Radix primitive at z-[70] through a
 * Portal, because MDrawer is an inline z-[60] layer and the shared
 * ui/alert-dialog (z-50) would open behind it (staging recipe memory;
 * same pattern as CustomerAddonsPanel).
 */
export function IspPartnerDetailDrawer({
  partnerId,
  canUpdate,
  canManage,
  onClose,
  onChanged,
}: {
  partnerId: string | null;
  canUpdate: boolean;
  canManage: boolean;
  onClose: () => void;
  onChanged: (p: IspPartner) => void;
}) {
  const [partner, setPartner] = useState<IspPartner | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [credential, setCredential] = useState<{ title: string; c: IspOwnerCredential } | null>(
    null,
  );
  const [edit, setEdit] = useState({
    supportPhone: "",
    supportEmail: "",
    maxCustomers: "",
    notes: "",
  });
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [owner, setOwner] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  useEffect(() => {
    setPartner(null);
    setLoadError(null);
    setCredential(null);
    setOwnerOpen(false);
    if (!partnerId) return;
    ispPartnerPlatformService
      .get(partnerId)
      .then((p) => {
        setPartner(p);
        setEdit({
          supportPhone: p.supportPhone ?? "",
          supportEmail: p.supportEmail ?? "",
          maxCustomers: p.maxCustomers == null ? "" : String(p.maxCustomers),
          notes: p.notes ?? "",
        });
      })
      .catch((err) => setLoadError(requestErrorOf(err)?.message ?? "Could not load this ISP."));
  }, [partnerId]);

  function apply(p: IspPartner) {
    // list rows carry no owners/acs; keep what the detail call loaded
    setPartner((prev) => ({ ...p, owners: p.owners ?? prev?.owners, acs: p.acs ?? prev?.acs }));
    onChanged(p);
  }

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast.error(requestErrorOf(err)?.message || failure);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!partner || !pending) return;
    if (pending.kind === "suspend") {
      if (!reason.trim()) {
        toast.error("Give a reason; the ISP's staff see it.");
        return;
      }
      await run(async () => {
        apply(await ispPartnerPlatformService.suspend(partner.id, reason.trim()));
        toast.success(`${partner.name} suspended`);
      }, "Could not suspend this ISP.");
    } else if (pending.kind === "activate") {
      await run(async () => {
        apply(await ispPartnerPlatformService.activate(partner.id));
        toast.success(`${partner.name} reactivated`);
      }, "Could not reactivate this ISP.");
    } else {
      const target = pending;
      await run(async () => {
        const c = await ispPartnerPlatformService.resetUserPassword(partner.id, target.userId);
        setCredential({ title: `New temporary password for ${target.name}`, c });
      }, "Could not reset the password.");
    }
    setPending(null);
    setReason("");
  }

  async function saveProfile() {
    if (!partner) return;
    if (edit.supportEmail.trim() && !EMAIL_RE.test(edit.supportEmail.trim())) {
      toast.error("Support email is not a valid address.");
      return;
    }
    if (edit.maxCustomers.trim() && !/^\d+$/.test(edit.maxCustomers.trim())) {
      toast.error("Customer limit must be a whole number, or empty for unlimited.");
      return;
    }
    await run(async () => {
      apply(
        await ispPartnerPlatformService.update(partner.id, {
          supportPhone: edit.supportPhone.trim() || null,
          supportEmail: edit.supportEmail.trim() || null,
          maxCustomers: edit.maxCustomers.trim() ? Number(edit.maxCustomers.trim()) : null,
          notes: edit.notes.trim() || null,
        }),
      );
      toast.success("Saved");
    }, "Could not save.");
  }

  async function addOwner() {
    if (!partner) return;
    if (!owner.firstName.trim() || !owner.lastName.trim() || !EMAIL_RE.test(owner.email.trim())) {
      toast.error("First name, last name and a valid email are required.");
      return;
    }
    setBusy(true);
    try {
      const c = await ispPartnerPlatformService.addOwner(partner.id, {
        firstName: owner.firstName.trim(),
        lastName: owner.lastName.trim(),
        email: owner.email.trim(),
        phone: owner.phone.trim() || null,
        sendWelcomeEmail: true,
      });
      setCredential({ title: `Owner sign-in for ${owner.firstName.trim()}`, c });
      setOwner({ firstName: "", lastName: "", email: "", phone: "" });
      setOwnerOpen(false);
      apply(await ispPartnerPlatformService.get(partner.id));
    } catch (err) {
      const e = requestErrorOf(err);
      toast.error(
        e?.data?.code === "USER_EMAIL_TAKEN"
          ? "A user with this email already exists."
          : e?.message || "Could not add the owner.",
      );
    } finally {
      setBusy(false);
    }
  }

  const suspended = partner?.status === "suspended";

  return (
    <MDrawer
      open={!!partnerId}
      onClose={onClose}
      title={partner?.name ?? "ISP partner"}
      subtitle={partner ? partner.slug : undefined}
    >
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {!partner && !loadError && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {partner && (
        <div className="space-y-6">
          {credential && (
            <TemporaryPasswordPanel credential={credential.c} title={credential.title} />
          )}

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <MTag
                label={suspended ? "Suspended" : "Active"}
                tone={suspended ? "suspended" : "active"}
              />
              {partner.defaultCustomerPlan && (
                <span className="text-xs text-muted-foreground">
                  Customer plan: {partner.defaultCustomerPlan.name}
                </span>
              )}
            </div>
            {suspended && partner.suspendedReason && (
              <p className="text-xs text-muted-foreground">
                Suspended{" "}
                {partner.suspendedAt ? new Date(partner.suspendedAt).toLocaleString() : ""}:{" "}
                {partner.suspendedReason}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Suspending blocks every ISP dashboard call and every CPE sign-in on the ISP's ACS
              credentials. Its customers' guest WiFi keeps working.
            </p>
          </section>

          <section className="grid grid-cols-2 gap-3 text-sm">
            <Fact
              label="Customers"
              value={`${partner.counts.customers}${partner.counts.customersSuspended ? ` (${partner.counts.customersSuspended} suspended)` : ""}`}
            />
            <Fact label="Locations" value={partner.counts.locations} />
            <Fact
              label="Routers online"
              value={`${partner.counts.routersOnline} / ${partner.counts.routersTotal}`}
            />
            <Fact
              label="CPEs online"
              value={`${partner.counts.cpesOnline} / ${partner.counts.cpesTotal}`}
            />
            <Fact label="ISP staff users" value={partner.counts.users} />
            <Fact label="Customer limit" value={partner.maxCustomers ?? "Unlimited"} />
          </section>

          <section className="space-y-1 text-sm">
            <Fact
              label="Contact"
              value={[partner.contactEmail, partner.contactPhone].filter(Boolean).join(" · ")}
            />
            {partner.legalName && <Fact label="Legal name" value={partner.legalName} />}
            {partner.gstin && <Fact label="GSTIN" value={partner.gstin} />}
            <Fact label="Timezone" value={partner.timezone} />
            <Fact
              label="ACS credential"
              value={
                partner.acs
                  ? `${partner.acs.username} · ${partner.acs.enabled ? "enabled" : "disabled"}`
                  : "Not provisioned"
              }
            />
          </section>

          <IspParityPanel partnerId={partner.id} canUpdate={canUpdate} />

          {canUpdate && (
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Edit
              </h4>
              <MField label="Support phone">
                <input
                  className={M_INPUT}
                  value={edit.supportPhone}
                  onChange={(e) => setEdit({ ...edit, supportPhone: e.target.value })}
                />
              </MField>
              <MField label="Support email">
                <input
                  className={M_INPUT}
                  value={edit.supportEmail}
                  onChange={(e) => setEdit({ ...edit, supportEmail: e.target.value })}
                />
              </MField>
              <MField label="Customer limit (empty = unlimited)">
                <input
                  className={M_INPUT}
                  inputMode="numeric"
                  value={edit.maxCustomers}
                  onChange={(e) => setEdit({ ...edit, maxCustomers: e.target.value })}
                />
              </MField>
              <MField label="Notes">
                <textarea
                  className={M_INPUT}
                  rows={2}
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                />
              </MField>
              <MButton variant="outline" onClick={saveProfile} disabled={busy}>
                <Save /> Save
              </MButton>
            </section>
          )}

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Owners
            </h4>
            {(partner.owners ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">No owner listed.</p>
            )}
            {(partner.owners ?? []).map((o) => (
              <div
                key={o.userId}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{o.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {o.email} {o.status === "disabled" ? "· disabled" : ""}
                  </div>
                </div>
                {canManage && (
                  <MButton
                    variant="outline"
                    disabled={busy}
                    onClick={() => setPending({ kind: "reset", userId: o.userId, name: o.name })}
                  >
                    <KeyRound /> Reset password
                  </MButton>
                )}
              </div>
            ))}
            {canManage && !ownerOpen && (
              <MButton variant="outline" onClick={() => setOwnerOpen(true)}>
                <UserPlus /> Add owner
              </MButton>
            )}
            {canManage && ownerOpen && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={M_INPUT}
                    placeholder="First name"
                    value={owner.firstName}
                    onChange={(e) => setOwner({ ...owner, firstName: e.target.value })}
                  />
                  <input
                    className={M_INPUT}
                    placeholder="Last name"
                    value={owner.lastName}
                    onChange={(e) => setOwner({ ...owner, lastName: e.target.value })}
                  />
                </div>
                <input
                  className={M_INPUT}
                  placeholder="Email"
                  type="email"
                  value={owner.email}
                  onChange={(e) => setOwner({ ...owner, email: e.target.value })}
                />
                <input
                  className={M_INPUT}
                  placeholder="Phone (optional)"
                  value={owner.phone}
                  onChange={(e) => setOwner({ ...owner, phone: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <MButton variant="ghost" onClick={() => setOwnerOpen(false)} disabled={busy}>
                    Cancel
                  </MButton>
                  <MButton onClick={addOwner} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Add owner
                  </MButton>
                </div>
              </div>
            )}
          </section>

          {canManage && (
            <section className="border-t border-border pt-4">
              {suspended ? (
                <MButton onClick={() => setPending({ kind: "activate" })} disabled={busy}>
                  <Play /> Reactivate ISP
                </MButton>
              ) : (
                <MButton
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setPending({ kind: "suspend" })}
                  disabled={busy}
                >
                  <Pause /> Suspend ISP
                </MButton>
              )}
            </section>
          )}
        </div>
      )}

      <AlertDialogPrimitive.Root open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/60" />
          <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[70] grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-card p-5 shadow-2xl">
            <AlertDialogPrimitive.Title className="text-base font-semibold">
              {pending?.kind === "suspend" && `Suspend ${partner?.name}?`}
              {pending?.kind === "activate" && `Reactivate ${partner?.name}?`}
              {pending?.kind === "reset" && `Reset ${pending.name}'s password?`}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
              {pending?.kind === "suspend" &&
                "The ISP's staff are signed out of every ISP dashboard call, and its CPEs are refused at the ACS. Customers' guest WiFi is not touched."}
              {pending?.kind === "activate" &&
                "The ISP's dashboard and its ACS credentials work again immediately."}
              {pending?.kind === "reset" &&
                "Their current password stops working. You will see the new temporary password once."}
            </AlertDialogPrimitive.Description>
            {pending?.kind === "suspend" && (
              <textarea
                className={M_INPUT}
                rows={2}
                maxLength={255}
                placeholder="Reason (shown to the ISP)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
            <div className="flex justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <MButton variant="outline" disabled={busy}>
                  Cancel
                </MButton>
              </AlertDialogPrimitive.Cancel>
              <MButton
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  void confirm();
                }}
              >
                {busy && <Loader2 className="animate-spin" />}
                {pending?.kind === "suspend"
                  ? "Suspend"
                  : pending?.kind === "activate"
                    ? "Reactivate"
                    : "Reset password"}
              </MButton>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </MDrawer>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
