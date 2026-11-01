/**
 * PPPoE login for one subscriber (Phase 2b, lane JAZE-6). Self-contained so
 * the Subscriber 360 page (JAZE-1) can mount it as a tab:
 * `<SubscriberPppoePanel subscriberId=… />`.
 *
 * The password is never read back. The API returns it once, in the reply to
 * the call that set or generated it; it is shown here until the panel closes.
 */
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Unplug } from "lucide-react";
import { MButton, MSeg, MTag } from "@/components/master/MasterKit";
import {
  Card,
  CopyField,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { PppoeSessionTable } from "@/components/isp-partner/pppoe/PppoeSessionTable";
import { usePppoeCredential, usePppoeMutation } from "@/hooks/isp-partner/usePppoe";
import { isNotFound, ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  authResultLabel,
  authResultTone,
  credentialBody,
  formatMac,
  kickSummary,
  type CredentialDraft,
} from "@/lib/isp-partner/pppoe";
import { pppoeService } from "@/services/isp-partner/pppoe";
import type { PppoeCredential, PppoeCredentialBody } from "@/services/isp-partner/pppoe-types";

type Configured = Extract<PppoeCredential, { configured: true }>;

function draftOf(c: Configured | null): CredentialDraft {
  return {
    username: c?.username ?? "",
    passwordMode: c ? "keep" : "generate",
    password: "",
    static_ip: c?.static_ip ?? "",
    ip_pool_name: c?.ip_pool_name ?? "",
  };
}

export function SubscriberPppoePanel({ subscriberId }: { subscriberId: string }) {
  const q = usePppoeCredential(subscriberId);
  if (q.isLoading) return <LoadingBlock />;
  // Feature off (ISP_PPPOE_ENABLED) = 404: say nothing on a shared page.
  if (isNotFound(q.error)) return null;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the PPPoE login" />;
  // Keyed on the subscriber only: the form seeds once and is re-seeded from
  // the save reply, so a background refetch never wipes edits or the
  // one-time password.
  return <CredentialCard key={subscriberId} subscriberId={subscriberId} cred={q.data} />;
}

function CredentialCard({ subscriberId, cred }: { subscriberId: string; cred: PppoeCredential }) {
  const { can } = usePartner();
  const editable = can("isp_subscribers.update");
  const c = cred.configured ? cred : null;
  const [draft, setDraft] = useState<CredentialDraft>(() => draftOf(c));
  const [err, setErr] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const save = usePppoeMutation((body: PppoeCredentialBody) =>
    pppoeService.saveCredential(subscriberId, body),
  );
  const toggle = usePppoeMutation((on: boolean) => pppoeService.setEnabled(subscriberId, on));
  const kick = usePppoeMutation(() => pppoeService.disconnectSubscriber(subscriberId));
  const set = <K extends keyof CredentialDraft>(k: K, v: CredentialDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const onSave = async () => {
    setErr(null);
    const r = credentialBody(draft, c);
    if ("error" in r) return setErr(r.error);
    if (c && Object.keys(r.body).length === 0) return setErr("Nothing changed.");
    try {
      const out = await save.mutateAsync(r.body);
      setRevealed(out.password ?? null);
      if (out.configured) setDraft(draftOf(out));
      toast.success(c ? "PPPoE login saved." : "PPPoE login created.");
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="PPPoE login"
        actions={
          c ? (
            <>
              <MTag
                label={c.status === "active" ? "Enabled" : "Disabled"}
                tone={c.status === "active" ? "active" : "suspended"}
              />
              <MTag label={c.online ? "Online" : "Offline"} tone={c.online ? "active" : "normal"} />
            </>
          ) : (
            <MTag label="Not set up" tone="pending" />
          )
        }
      >
        {c && (
          <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Last sign-in</dt>
            <dd>
              <MTag
                label={authResultLabel(c.last_auth_result)}
                tone={authResultTone(c.last_auth_result)}
              />{" "}
              {c.last_auth_at && formatDateTime(c.last_auth_at)}
            </dd>
            <dt className="text-muted-foreground">Last device</dt>
            <dd className="font-mono">{formatMac(c.last_mac)}</dd>
            <dt className="text-muted-foreground">Password set</dt>
            <dd>{formatDateTime(c.password_set_at)}</dd>
          </dl>
        )}
        {!c && (
          <p className="mb-3 text-xs text-muted-foreground">
            Gives this subscriber a PPPoE username and password for their router. Leave the username
            blank to use their login id. Speed and validity follow their package.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Username"
            value={draft.username}
            onChange={(v) => set("username", v)}
            disabled={!editable}
            placeholder={c ? undefined : "Their login id"}
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <MSeg<CredentialDraft["passwordMode"]>
              value={draft.passwordMode}
              onChange={(v) => set("passwordMode", v)}
              options={[
                ...(c ? [{ value: "keep" as const, label: "Keep" }] : []),
                { value: "generate", label: "Generate" },
                { value: "set", label: "Type one" },
              ]}
            />
          </label>
          {draft.passwordMode === "set" && (
            <TextField
              label="New password"
              type="password"
              value={draft.password}
              onChange={(v) => set("password", v)}
              hint="8-64 characters, no spaces, quotes, \ $ or `."
            />
          )}
          <TextField
            label="Static IP (optional)"
            value={draft.static_ip}
            onChange={(v) => set("static_ip", v)}
            disabled={!editable}
            hint="Handed out by RADIUS instead of the pool."
          />
          <TextField
            label="IP pool on the router (optional)"
            value={draft.ip_pool_name}
            onChange={(v) => set("ip_pool_name", v)}
            disabled={!editable}
            hint="Name of a /ip pool; blank uses the PPPoE profile's pool."
          />
        </div>
        {revealed && (
          <div className="mt-3 space-y-1">
            <CopyField label="Password (shown once, give it to the subscriber)" value={revealed} />
            <p className="text-[11px] text-muted-foreground">
              It cannot be shown again. Generate a new one if it is lost.
            </p>
          </div>
        )}
        <FormError message={err} />
        {editable && (
          <div className="mt-3 flex flex-wrap gap-2">
            <MButton onClick={onSave} disabled={save.isPending}>
              {save.isPending ? <Spinner /> : <KeyRound />} {c ? "Save" : "Create PPPoE login"}
            </MButton>
            {c && (
              <MButton
                variant="outline"
                disabled={toggle.isPending}
                onClick={async () => {
                  setErr(null);
                  const on = c.status !== "active";
                  try {
                    const r = await toggle.mutateAsync(on);
                    toast.success(
                      on
                        ? "PPPoE login enabled."
                        : `PPPoE login disabled. ${kickSummary(r.disconnects ?? [])}`,
                    );
                  } catch (e) {
                    setErr(ispErrorMessage(e));
                  }
                }}
              >
                {c.status === "active" ? "Disable" : "Enable"}
              </MButton>
            )}
            {c?.online && (
              <MButton
                variant="outline"
                disabled={kick.isPending}
                onClick={async () => {
                  setErr(null);
                  try {
                    const r = await kick.mutateAsync(undefined);
                    toast.success(kickSummary(r.results));
                  } catch (e) {
                    setErr(ispErrorMessage(e));
                  }
                }}
              >
                {kick.isPending ? <Spinner /> : <Unplug />} Disconnect
              </MButton>
            )}
          </div>
        )}
      </Card>
      {c && c.active_sessions.length > 0 && (
        <Card title="Live PPPoE sessions">
          <PppoeSessionTable sessions={c.active_sessions} showUser={false} />
        </Card>
      )}
    </div>
  );
}
