/**
 * Captive portal editor for one location (PRD §4.6, TASKS FE-6), over the
 * `/isp/captive-portal-configs/*` twins with the existing
 * `CaptivePortalConfigUpdateRequest` body. Rebuilt here rather than reusing
 * the customer app's editor, which is bound to the customer store.
 *
 * Only changed fields are sent. Validation is the backend's: the headline's
 * 26-character budget, for one, comes back as a 400 whose message is shown
 * as is.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Globe } from "lucide-react";
import { MButton, MEmptyState, MTag, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, LoadingBlock, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import {
  useActivateIspPortalConfig,
  useIspPortalConfigs,
  useUpdateIspPortalConfig,
} from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import type { CaptivePortalConfig, CaptivePortalConfigUpdate } from "@/services/isp-partner/types";

/** The guest-facing headline budget (backend `SPLASH_HEADLINE_MAX_LENGTH`). */
const HEADLINE_BUDGET = 26;

const TEXT_FIELDS = [
  "splash_headline",
  "splash_welcome_message",
  "logo_url",
  "background_image_url",
  "primary_color",
  "secondary_color",
  "theme",
  "terms_and_conditions_text",
  "terms_and_conditions_url",
  "privacy_policy_url",
  "redirect_url",
] as const;
type TextKey = (typeof TEXT_FIELDS)[number];

const LOGIN_METHODS = [
  ["otp_sms_enabled", "Phone OTP (SMS)"],
  ["otp_whatsapp_enabled", "Phone OTP (WhatsApp)"],
  ["otp_email_enabled", "Email OTP"],
  ["voucher_enabled", "Voucher code"],
  ["username_password_enabled", "Username and password"],
  ["pin_login_enabled", "PIN"],
] as const;
const COLLECT = [
  ["collect_guest_name", "Ask for the guest's name"],
  ["collect_guest_email", "Ask for the guest's email"],
] as const;
type BoolKey = (typeof LOGIN_METHODS)[number][0] | (typeof COLLECT)[number][0];
const BOOL_FIELDS: BoolKey[] = [...LOGIN_METHODS.map((m) => m[0]), ...COLLECT.map((m) => m[0])];

type Draft = Record<TextKey, string> & Record<BoolKey, boolean>;

function toDraft(c: CaptivePortalConfig): Draft {
  const d = {} as Draft;
  for (const k of TEXT_FIELDS) d[k] = (c[k] as string | null | undefined) ?? "";
  for (const k of BOOL_FIELDS) d[k] = Boolean(c[k]);
  return d;
}

function diff(c: CaptivePortalConfig, d: Draft): CaptivePortalConfigUpdate {
  const out: Record<string, unknown> = {};
  for (const k of TEXT_FIELDS) {
    const before = (c[k] as string | null | undefined) ?? "";
    if (d[k] !== before) {
      // Colours and theme are non-nullable on the backend.
      const required = k === "primary_color" || k === "secondary_color" || k === "theme";
      out[k] = d[k].trim() === "" ? (required ? before : null) : d[k].trim();
    }
  }
  for (const k of BOOL_FIELDS) if (d[k] !== Boolean(c[k])) out[k] = d[k];
  return out as CaptivePortalConfigUpdate;
}

function pickConfig(items: CaptivePortalConfig[], locationId: string): CaptivePortalConfig | null {
  const own = items.filter((c) => c.location_id === locationId);
  const pool = own.length ? own : items;
  return pool.find((c) => c.is_active) ?? pool[0] ?? null;
}

function Editor({ locationId, config }: { locationId: string; config: CaptivePortalConfig }) {
  const { can } = usePartner();
  const editable = can("isp_partner.update");
  const [draft, setDraft] = useState<Draft>(() => toDraft(config));
  const [error, setError] = useState<string | null>(null);
  const save = useUpdateIspPortalConfig(locationId, config.id);
  const activate = useActivateIspPortalConfig(locationId);

  useEffect(() => setDraft(toDraft(config)), [config]);
  const changes = useMemo(() => diff(config, draft), [config, draft]);
  const dirty = Object.keys(changes).length > 0;
  const headlineLen = [...draft.splash_headline.trim()].length;
  const anyMethod = LOGIN_METHODS.some(([k]) => draft[k]);

  const setText = (k: TextKey) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const onSave = async () => {
    if (!anyMethod) {
      setError("Keep at least one sign-in method on, or guests cannot get online.");
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(changes);
      toast.success("Portal saved. Guests see it on their next sign-in.");
    } catch (err) {
      setError(ispErrorMessage(err, "Could not save the portal."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{config.name}</span>
        <MTag label={config.is_active ? "Active" : "Inactive"} tone={config.is_active ? "active" : "normal"} />
        {!config.is_active && editable && (
          <MButton
            variant="outline"
            disabled={activate.isPending}
            onClick={async () => {
              try {
                await activate.mutateAsync(config.id);
                toast.success("Portal activated.");
              } catch (err) {
                toast.error(ispErrorMessage(err));
              }
            }}
          >
            {activate.isPending && <Spinner />} Activate
          </MButton>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Welcome screen">
          <div className="space-y-3">
            <TextField
              label="Headline"
              value={draft.splash_headline}
              onChange={setText("splash_headline")}
              disabled={!editable}
              hint={`${headlineLen}/${HEADLINE_BUDGET} characters. Longer headlines are refused so they fit a phone screen.`}
              error={headlineLen > HEADLINE_BUDGET ? `${headlineLen}/${HEADLINE_BUDGET}: too long for the portal.` : undefined}
            />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Welcome message</span>
              <textarea
                className={M_INPUT}
                rows={3}
                value={draft.splash_welcome_message}
                disabled={!editable}
                onChange={(e) => setText("splash_welcome_message")(e.target.value)}
              />
            </label>
            <TextField label="Logo URL" value={draft.logo_url} onChange={setText("logo_url")} disabled={!editable} />
            <TextField
              label="Background image URL"
              value={draft.background_image_url}
              onChange={setText("background_image_url")}
              disabled={!editable}
            />
          </div>
        </Card>
        <Card title="Look">
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Theme</span>
              <select
                className={M_INPUT}
                value={draft.theme}
                disabled={!editable}
                onChange={(e) => setText("theme")(e.target.value)}
              >
                {Array.from(new Set(["light", "dark", draft.theme].filter(Boolean))).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["primary_color", "secondary_color"] as const).map((k) => (
                <label key={k} className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {k === "primary_color" ? "Primary colour" : "Secondary colour"}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(draft[k]) ? draft[k] : "#000000"}
                      disabled={!editable}
                      onChange={(e) => setText(k)(e.target.value)}
                      className="h-9 w-10 rounded border border-border"
                      aria-label={k}
                    />
                    <input
                      className={M_INPUT}
                      value={draft[k]}
                      maxLength={7}
                      disabled={!editable}
                      onChange={(e) => setText(k)(e.target.value)}
                    />
                  </div>
                </label>
              ))}
            </div>
            <TextField
              label="After sign-in, open"
              value={draft.redirect_url}
              onChange={setText("redirect_url")}
              disabled={!editable}
              hint="Optional URL. Empty keeps the default success page."
            />
          </div>
        </Card>
        <Card title="Sign-in methods">
          <div className="space-y-2">
            {LOGIN_METHODS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft[k]}
                  disabled={!editable}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
            <div className="my-2 border-t border-border" />
            {COLLECT.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft[k]}
                  disabled={!editable}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </Card>
        <Card title="Terms">
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Terms and conditions</span>
              <textarea
                className={M_INPUT}
                rows={4}
                value={draft.terms_and_conditions_text}
                disabled={!editable}
                onChange={(e) => setText("terms_and_conditions_text")(e.target.value)}
              />
            </label>
            <TextField
              label="Terms URL"
              value={draft.terms_and_conditions_url}
              onChange={setText("terms_and_conditions_url")}
              disabled={!editable}
            />
            <TextField
              label="Privacy policy URL"
              value={draft.privacy_policy_url}
              onChange={setText("privacy_policy_url")}
              disabled={!editable}
            />
          </div>
        </Card>
      </div>

      <FormError message={error} />
      {editable && (
        <div className="flex justify-end gap-2">
          <MButton variant="outline" disabled={!dirty || save.isPending} onClick={() => setDraft(toDraft(config))}>
            Discard changes
          </MButton>
          <MButton disabled={!dirty || save.isPending} onClick={onSave}>
            {save.isPending && <Spinner />} Save portal
          </MButton>
        </div>
      )}
    </div>
  );
}

export function PortalEditor({ locationId }: { locationId: string }) {
  const q = useIspPortalConfigs(locationId);
  if (q.isLoading) return <LoadingBlock label="Loading the portal…" />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the captive portal" />;
  const config = pickConfig(q.data.items, locationId);
  if (!config)
    return (
      <MEmptyState
        icon={Globe}
        title="This location has no portal"
        description="A portal is created with every new location. If this one has none, contact Wyfy Guest support."
      />
    );
  return <Editor key={config.id} locationId={locationId} config={config} />;
}
