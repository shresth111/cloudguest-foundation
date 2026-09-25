import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarClock, Check, Loader2, Send, Zap } from "lucide-react";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useCustomerStore } from "@/stores/customerStore";
import {
  useCreateCampaign,
  useMarketingTemplates,
  useTemplatePreview,
  useUpdateCampaign,
} from "@/hooks/useMarketing";
import { campaignVariableMaxLength, campaignVariablesIn } from "@/lib/marketing-template";
import {
  MARKETING_CHANNELS,
  type AudienceFilter,
  type AudiencePreview,
  type CampaignCreatePayload,
  type CampaignVariable,
  type MarketingCampaign,
  type MarketingChannel,
  type MarketingStatus,
  type MarketingTemplate,
} from "@/types/marketing";
import {
  CHANNEL_ICON,
  SENDABLE_REASON_LABEL,
  channelNotLiveCopy,
  channelStatusFor,
  marketingErrorMessage,
  useChannelLabel,
  useMarketingCan,
} from "../marketing-helpers";
import { AudienceFilterForm } from "../audience/AudienceFilterForm";
import { audienceFilterInvalid, cleanAudienceFilter } from "../marketing-helpers";
import { AudiencePreviewCard } from "../audience/AudiencePreviewCard";
import { EmailPreviewFrame } from "../templates/EmailPreviewFrame";
import { ScheduleDialog, TestSendDialog } from "./CampaignActions";

type Step = 1 | 2 | 3 | 4;

const VARIABLE_LABEL: Record<string, string> = {
  offer_code: "Offer code",
  offer_expiry: "Offer valid till",
  event_name: "Event name",
  event_date: "Event date",
  booking_link: "Booking link",
};

const VARIABLE_PLACEHOLDER: Record<string, string> = {
  offer_code: "e.g. BRUNCH20",
  offer_expiry: "e.g. 30 Sep",
  event_name: "e.g. Live jazz night",
  event_date: "e.g. Sat 4 Oct, 8 pm",
  booking_link: "https://…",
};

function defaultChannel(status: MarketingStatus): MarketingChannel {
  return status.channels.find((c) => c.configured)?.channel ?? "whatsapp";
}

function defaultName(t: MarketingTemplate): string {
  const d = new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${t.name} · ${d}`.slice(0, 120);
}

/**
 * New campaign / edit draft (spec §8.1 CampaignComposerSheet):
 *
 *   1 Channel & template → 2 Details → 3 Audience → 4 Review & send
 *
 * A draft is saved to the server when step 1 is left (POST), and again as
 * each later step is left (PATCH with the version the server last
 * returned), so closing the sheet at any point keeps what was entered as a
 * real draft -- and the review step's preview, test and schedule all act on
 * the stored draft rather than on something only this browser holds.
 *
 * Nothing on this sheet can reach a guest who has not opted in: the
 * audience step offers only narrowing filters, and consent is applied by
 * the server on every count and again at send time.
 */
export function CampaignComposerSheet({
  open,
  onOpenChange,
  status,
  locationId,
  draft,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  status: MarketingStatus;
  locationId: string | null;
  /** An existing draft to continue editing, or null for a new campaign. */
  draft: MarketingCampaign | null;
  /** Called with the campaign id once it has been scheduled or sent. */
  onDone?: (id: string) => void;
}) {
  const { t } = useTranslation("marketing", { i18n });
  const label = useChannelLabel();
  const can = useMarketingCan();
  const venueName = useCustomerStore((s) => s.activeLocation?.name ?? null);
  const create = useCreateCampaign();
  const update = useUpdateCampaign();

  const [step, setStep] = useState<Step>(1);
  const [channel, setChannel] = useState<MarketingChannel>(() => defaultChannel(status));
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [vars, setVars] = useState<Partial<Record<CampaignVariable, string>>>({});
  const [filter, setFilter] = useState<AudienceFilter>({ channel });
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<AudiencePreview | undefined>(undefined);
  const [testOpen, setTestOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later" | null>(null);

  // Seed on open: from the draft being continued, or fresh.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setAudience(undefined);
    if (draft) {
      setStep(2);
      setChannel(draft.channel);
      setTemplateId(draft.template.id);
      setName(draft.name);
      setVars(draft.variables ?? {});
      setFilter({ ...draft.audience_filter, channel: draft.channel });
      setCampaignId(draft.id);
      setVersion(draft.version);
    } else {
      const c = defaultChannel(status);
      setStep(1);
      setChannel(c);
      setTemplateId(null);
      setName("");
      setVars({});
      setFilter({ channel: c });
      setCampaignId(null);
      setVersion(null);
    }
    // Seed once per opening; `status` changing underneath must not reset a
    // half-filled form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  const templates = useMarketingTemplates({
    channel,
    include_system: true,
    page: 1,
    page_size: 100,
  });
  const channelTemplates = useMemo(
    () => (templates.data?.items ?? []).filter((tp) => tp[channel] !== null),
    [templates.data, channel],
  );
  const template = channelTemplates.find((tp) => tp.id === templateId) ?? null;
  const neededVars = template ? campaignVariablesIn(template.variables) : [];

  const cs = channelStatusFor(status.channels, channel);
  const channelLive = !!cs?.configured;
  const sendable = template?.sendable[channel];

  const saving = create.isPending || update.isPending;

  const payload = (): CampaignCreatePayload => {
    const cleanVars: Partial<Record<CampaignVariable, string>> = {};
    for (const [k, v] of Object.entries(vars)) {
      if (v && v.trim() && neededVars.includes(k)) cleanVars[k as CampaignVariable] = v.trim();
    }
    return {
      name: name.trim() || (template ? defaultName(template) : "Untitled campaign"),
      channel,
      template_id: templateId!,
      location_id: locationId,
      variables: cleanVars,
      audience_filter: cleanAudienceFilter({ ...filter, channel }),
    };
  };

  /** Persist the draft. Returns its id, or null (and shows why) on failure. */
  const saveDraft = async (): Promise<string | null> => {
    if (!templateId) return null;
    setError(null);
    try {
      const body = payload();
      const saved =
        campaignId && version !== null
          ? await update.mutateAsync({ id: campaignId, body: { ...body, version } })
          : await create.mutateAsync(body);
      setCampaignId(saved.id);
      setVersion(saved.version);
      if (!name.trim()) setName(saved.name);
      return saved.id;
    } catch (err) {
      setError(marketingErrorMessage(err, "Couldn't save the draft."));
      return null;
    }
  };

  const next = async () => {
    const id = await saveDraft();
    if (id) setStep((s) => Math.min(4, s + 1) as Step);
  };

  const varsTooLong = neededVars.some(
    (v) => (vars[v as CampaignVariable] ?? "").length > campaignVariableMaxLength(v),
  );
  const stepValid: Record<Step, boolean> = {
    1: !!templateId,
    2: name.trim().length > 0 && name.trim().length <= 120 && !varsTooLong,
    3: !audienceFilterInvalid(filter),
    4: true,
  };

  const reviewBody =
    open && step === 4 && templateId
      ? {
          channel,
          template_id: templateId,
          content: null,
          variables: payload().variables,
          location_id: locationId,
        }
      : null;
  const preview = useTemplatePreview(reviewBody);

  const blockers: string[] = [];
  if (!channelLive) blockers.push(channelNotLiveCopy(label(channel)));
  if (sendable && !sendable.ok)
    blockers.push(
      (sendable.reason && SENDABLE_REASON_LABEL[sendable.reason]) ||
        "This template can't be sent yet.",
    );
  if (audience && audience.reachable === 0)
    blockers.push("Nobody in this audience has opted in, so there is no one to send to.");

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: t("wizard.template", "Template") },
    { n: 2, label: t("wizard.details", "Details") },
    { n: 3, label: t("wizard.audience", "Audience") },
    { n: 4, label: t("wizard.review", "Review & send") },
  ];

  const close = () => {
    if (saving) return;
    if (campaignId) toast.message("Saved as a draft. You'll find it under Campaigns.");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{draft ? `Edit “${draft.name}”` : "New campaign"}</SheetTitle>
          <SheetDescription>
            {venueName ? `For guests of ${venueName} who opted in.` : "For guests who opted in."}
          </SheetDescription>
        </SheetHeader>

        <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Steps">
          {steps.map((s) => (
            <li key={s.n}>
              <button
                type="button"
                disabled={s.n > step || saving}
                onClick={() => setStep(s.n)}
                aria-current={s.n === step ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  s.n === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : s.n < step
                      ? "border-primary/40 text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {s.n < step ? <Check className="h-3 w-3" aria-hidden /> : <span>{s.n}</span>}
                {s.label}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-5 space-y-5">
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <div className="grid grid-cols-3 gap-2">
                  {MARKETING_CHANNELS.map((c) => {
                    const Icon = CHANNEL_ICON[c];
                    const st = channelStatusFor(status.channels, c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={channel === c}
                        disabled={!!campaignId && channel !== c && saving}
                        onClick={() => {
                          setChannel(c);
                          setFilter((f) => ({ ...f, channel: c }));
                          setTemplateId(null);
                        }}
                        className={cn(
                          "rounded-lg border p-2.5 text-left text-xs",
                          channel === c
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <Icon className="h-4 w-4" aria-hidden /> {label(c)}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {st?.configured ? "Live" : "Not set up"} ·{" "}
                          {(status.consent_counts[c] ?? 0).toLocaleString()} opted in
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!channelLive && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {channelNotLiveCopy(label(channel))} You can still prepare a draft.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Template</Label>
                {templates.isLoading ? (
                  <LoadingSkeleton rows={4} />
                ) : templates.isError ? (
                  <p className="text-sm text-red-600">
                    {marketingErrorMessage(templates.error, "Couldn't load templates.")}
                  </p>
                ) : channelTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No template has {label(channel)} text yet.
                    {channel === "whatsapp" ? "" : " Create one in the Templates tab."}
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {channelTemplates.map((tp) => {
                      const s = tp.sendable[channel];
                      const selected = tp.id === templateId;
                      return (
                        <button
                          key={tp.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setTemplateId(tp.id);
                            if (!name.trim() || (template && name === defaultName(template)))
                              setName(defaultName(tp));
                          }}
                          className={cn(
                            "rounded-lg border p-3 text-left",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50",
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{tp.name}</span>
                            {tp.is_system && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                Wyfy
                              </span>
                            )}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                            {tp[channel] && "body" in tp[channel]!
                              ? (tp[channel] as { body: string }).body
                              : tp.email?.subject}
                          </span>
                          <span
                            className={cn(
                              "mt-1.5 flex items-start gap-1 text-[11px]",
                              s?.ok
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-amber-700 dark:text-amber-400",
                            )}
                          >
                            {s?.ok ? (
                              <>
                                <Check className="mt-px h-3 w-3" aria-hidden /> Ready to send
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
                                {(s?.reason && SENDABLE_REASON_LABEL[s.reason]) ||
                                  "Not sendable yet"}
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cc-name">Campaign name</Label>
                <Input
                  id="cc-name"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Only you see this.</p>
              </div>
              {neededVars.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {neededVars.map((v) => {
                    const max = campaignVariableMaxLength(v);
                    const val = vars[v as CampaignVariable] ?? "";
                    return (
                      <div key={v} className="space-y-1.5">
                        <Label htmlFor={`cc-${v}`}>{VARIABLE_LABEL[v] ?? v}</Label>
                        <Input
                          id={`cc-${v}`}
                          value={val}
                          placeholder={VARIABLE_PLACEHOLDER[v]}
                          onChange={(e) => setVars((p) => ({ ...p, [v]: e.target.value }))}
                          aria-invalid={val.length > max || undefined}
                        />
                        <p
                          className={cn(
                            "text-[11px]",
                            val.length > max ? "text-red-600" : "text-muted-foreground",
                          )}
                        >
                          {val.length}/{max}
                          {v !== "booking_link" && " (SMS registrations cap each value at 30)"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This template has nothing to fill in per campaign.
                </p>
              )}
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Venue:{" "}
                <span className="font-medium text-foreground">{venueName ?? "this venue"}</span>.
                Campaigns are created for the venue you're viewing; switch venue from the top bar
                for another one.
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <AudienceFilterForm
                value={filter}
                onChange={(f) => setFilter({ ...f, channel })}
                status={status}
                lockChannel
                venueName={venueName}
              />
              <AudiencePreviewCard
                filter={{ ...filter, channel }}
                status={status}
                onResult={setAudience}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">Channel</dt>
                  <dd>{label(channel)}</dd>
                  <dt className="text-muted-foreground">Template</dt>
                  <dd>{template?.name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Audience</dt>
                  <dd>
                    {audience
                      ? `${audience.reachable.toLocaleString()} opted-in guests reachable now`
                      : "Counting…"}
                  </dd>
                </dl>
              </div>

              <AudiencePreviewCard
                filter={{ ...filter, channel }}
                status={status}
                onResult={setAudience}
              />

              <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  What a guest receives (sample guest)
                  {preview.isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                </p>
                {preview.isError ? (
                  <p className="text-sm text-red-600">
                    {marketingErrorMessage(preview.error, "Couldn't render the preview.")}
                  </p>
                ) : preview.data ? (
                  <>
                    {preview.data.rendered.subject && (
                      <p className="text-sm font-semibold">{preview.data.rendered.subject}</p>
                    )}
                    {channel === "email" ? (
                      <EmailPreviewFrame html={preview.data.rendered.body} />
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {preview.data.rendered.body}
                      </p>
                    )}
                    {preview.data.sms && (
                      <p className="text-[11px] text-muted-foreground">
                        {preview.data.sms.length} characters · {preview.data.sms.segments} SMS part
                        {preview.data.sms.segments === 1 ? "" : "s"}
                        {preview.data.sms.encoding === "ucs2" ? " · Unicode" : ""}
                      </p>
                    )}
                    {preview.data.missing_variables.length > 0 && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                        Not filled in, will be blank: {preview.data.missing_variables.join(", ")}.
                        Go back to Details to set{" "}
                        {preview.data.missing_variables.length === 1 ? "it" : "them"}.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Rendering…</p>
                )}
              </div>

              {blockers.length > 0 && (
                <ul className="space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  {blockers.map((b) => (
                    <li key={b} className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {b}
                    </li>
                  ))}
                </ul>
              )}

              {can("execute") ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setTestOpen(true)}
                    disabled={saving || !campaignId}
                  >
                    <Send className="h-4 w-4" /> Send a test
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setScheduleMode("later")}
                    disabled={saving || !campaignId || blockers.length > 0}
                  >
                    <CalendarClock className="h-4 w-4" /> Schedule
                  </Button>
                  <Button
                    onClick={() => setScheduleMode("now")}
                    disabled={saving || !campaignId || blockers.length > 0}
                  >
                    <Zap className="h-4 w-4" /> Send now
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your role can prepare drafts but not send them. Someone with send access can
                  schedule it from the campaign list.
                </p>
              )}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <Button
              variant="ghost"
              onClick={() => (step === 1 ? close() : setStep((s) => (s - 1) as Step))}
              disabled={saving}
            >
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            {step < 4 ? (
              <Button onClick={next} disabled={saving || !stepValid[step]}>
                {saving ? "Saving…" : "Save & continue"}
              </Button>
            ) : (
              <Button variant="outline" onClick={close} disabled={saving}>
                Keep as draft
              </Button>
            )}
          </div>
        </div>

        {campaignId && (
          <>
            <TestSendDialog
              campaign={{ id: campaignId, channel }}
              open={testOpen}
              onOpenChange={setTestOpen}
              beforeSend={saveDraft}
            />
            <ScheduleDialog
              campaign={{ id: campaignId, channel, name: name.trim() || "this campaign" }}
              status={status}
              mode={scheduleMode ?? "later"}
              reachable={audience?.reachable ?? null}
              open={scheduleMode !== null}
              onOpenChange={(o) => !o && setScheduleMode(null)}
              beforeSchedule={saveDraft}
              onScheduled={(c) => {
                onOpenChange(false);
                onDone?.(c.id);
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
