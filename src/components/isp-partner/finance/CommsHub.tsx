/**
 * Finance tools → Message log, upgraded (COMMS-2, ADDENDUM_06): one log for
 * WhatsApp, email and Telegram with the delivery lifecycle, filters and CSV;
 * the per-event template library; and the Meta webhook set-up.
 *
 * While ISP_COMMS_HUB_ENABLED is off the API answers 404 and the existing
 * JAZE-4 Message log (`fallback`) is shown unchanged.
 */
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MButton,
  MDialog,
  MSeg,
  MTable,
  MTag,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import {
  Card,
  CopyField,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Pager,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage, ispErrorStatus } from "@/lib/isp-partner/errors";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { saveBlob } from "@/lib/isp-partner/download";
import {
  EVENT_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  filterErrors,
  unknownVariables,
  validWaName,
} from "@/lib/isp-partner/comms";
import {
  commsService,
  type CommsLogQuery,
  type CommsPreview,
  type CommsStatus,
  type CommsTemplate,
} from "@/services/isp-partner/comms";
import { M_FILTER, PAGE_TABS } from "@/components/isp-partner/ui/classes";
import { EmptyRow } from "@/components/isp-partner/ui/EmptyRow";

const ck = (...k: unknown[]) => ["isp", "comms", ...k] as const;
type Section = "logs" | "templates" | "webhook";

function LogsView() {
  const [channel, setChannel] = useState<"" | "whatsapp" | "email" | "telegram">("");
  const [status, setStatus] = useState<"" | CommsStatus>("");
  const [event, setEvent] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const q: CommsLogQuery = {
    channel: channel || undefined,
    status: status || undefined,
    event: event || undefined,
    phone: phone.trim() || undefined,
    email: email.trim() || undefined,
    date_from: from || undefined,
    date_to: to || undefined,
  };
  const err = filterErrors(q);
  const logs = useQuery({
    queryKey: ck("logs", q, page),
    queryFn: () => commsService.logs({ ...q, page, page_size: 25 }),
    retry: retryUnless4xx,
    enabled: !err,
  });
  const reset = () => setPage(1);
  const d = logs.data;
  return (
    <Card
      title="Messages"
      actions={
        <MButton
          variant="outline"
          disabled={busy || !!err}
          onClick={async () => {
            setBusy(true);
            try {
              const f = await commsService.exportCsv(q);
              saveBlob(f.blob, f.filename);
            } catch (e) {
              ispToastError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : <Download />} CSV
        </MButton>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MSeg<"" | "whatsapp" | "email" | "telegram">
          value={channel}
          onChange={(v) => {
            setChannel(v);
            reset();
          }}
          options={[
            { value: "", label: "All" },
            { value: "whatsapp", label: "WhatsApp" },
            { value: "email", label: "Email" },
            { value: "telegram", label: "Telegram" },
          ]}
        />
        <select
          className={`${M_FILTER} py-1`}
          aria-label="Status"
          value={status}
          onChange={(e) => (setStatus(e.target.value as "" | CommsStatus), reset())}
        >
          <option value="">Any status</option>
          {(Object.keys(STATUS_LABEL) as CommsStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className={`${M_FILTER} py-1`}
          aria-label="Event"
          value={event}
          onChange={(e) => (setEvent(e.target.value), reset())}
        >
          <option value="">Any event</option>
          {Object.entries(EVENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          className={`${M_INPUT} w-36 py-1`}
          placeholder="Phone"
          aria-label="Phone"
          value={phone}
          onChange={(e) => (setPhone(e.target.value), reset())}
        />
        <input
          className={`${M_INPUT} w-44 py-1`}
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={(e) => (setEmail(e.target.value), reset())}
        />
        <input
          type="date"
          className={`${M_FILTER} py-1`}
          aria-label="From"
          value={from}
          onChange={(e) => (setFrom(e.target.value), reset())}
        />
        <input
          type="date"
          className={`${M_FILTER} py-1`}
          aria-label="To"
          value={to}
          onChange={(e) => (setTo(e.target.value), reset())}
        />
      </div>
      {err ? (
        <p className="text-xs text-destructive">{err}</p>
      ) : logs.error ? (
        <ErrorBlock error={logs.error} onRetry={() => logs.refetch()} what="messages" />
      ) : (
        <>
          <MTable
            loading={logs.isLoading}
            head={
              <>
                <MTh>Time (IST)</MTh>
                <MTh>Channel</MTh>
                <MTh>Event</MTh>
                <MTh>To</MTh>
                <MTh>Content</MTh>
                <MTh>Status</MTh>
                <MTh>Error</MTh>
              </>
            }
          >
            {d?.items.length === 0 && (
              <EmptyRow
                kind="no-results"
                title="No messages for these filters"
                hint="Automatic WhatsApp, email and Telegram messages are listed here once they are sent."
              />
            )}
            {d?.items.map((r) => (
              <MTr key={r.id}>
                <MTd className="text-xs">{r.at_ist}</MTd>
                <MTd className="text-xs capitalize">{r.channel}</MTd>
                <MTd className="text-xs">{EVENT_LABEL[r.event] ?? r.event}</MTd>
                <MTd className="font-mono text-xs">{r.recipient}</MTd>
                <MTd className="text-xs">{r.content}</MTd>
                <MTd>
                  <span
                    title={
                      r.receipts
                        .map(
                          (x) => `${STATUS_LABEL[x.status as CommsStatus] ?? x.status} ${x.at_ist}`,
                        )
                        .join("\n") || undefined
                    }
                  >
                    <MTag label={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status]} />
                  </span>
                  {r.status_at_ist && (
                    <span className="block text-xs text-muted-foreground">{r.status_at_ist}</span>
                  )}
                </MTd>
                <MTd className="text-xs text-destructive">{r.error ?? ""}</MTd>
              </MTr>
            ))}
          </MTable>
          {d && (
            <>
              <Pager page={d.page} pages={d.pages} total={d.total} onPage={setPage} />
              <p className="mt-2 text-[11px] text-muted-foreground">{d.status_note}</p>
            </>
          )}
        </>
      )}
    </Card>
  );
}

function TemplateDialog({ t, onClose }: { t: CommsTemplate; onClose: () => void }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(t.enabled);
  const [subject, setSubject] = useState(t.email_subject ?? "");
  const [body, setBody] = useState(t.email_body ?? "");
  const [name, setName] = useState(t.wa_template_name ?? "");
  const [lang, setLang] = useState(t.wa_language ?? "en");
  const [preview, setPreview] = useState<CommsPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unknown = t.channel === "email" ? unknownVariables(`${subject} ${body}`, t.variables) : [];

  const save = async () => {
    setError(null);
    if (t.channel === "whatsapp" && name && !validWaName(name))
      return setError(
        "Use the template name exactly as in WhatsApp Manager (lowercase, digits, _).",
      );
    if (unknown.length) return setError(`Unknown variable(s): ${unknown.join(", ")}`);
    setBusy(true);
    try {
      await commsService.saveTemplate(
        t.event,
        t.channel,
        t.channel === "email"
          ? { enabled, email_subject: subject || null, email_body: body || null }
          : { enabled, wa_template_name: name || null, wa_language: lang || "en" },
      );
      await qc.invalidateQueries({ queryKey: ck("templates") });
      toast.success("Template saved.");
      onClose();
    } catch (e) {
      setError(ispErrorMessage(e, "Could not save the template."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MDialog
      open
      wide
      onClose={onClose}
      title={`${t.label} · ${t.channel === "whatsapp" ? "WhatsApp" : "Email"}`}
      footer={
        <>
          <MButton
            variant="outline"
            onClick={async () => {
              try {
                setPreview(
                  await commsService.preview(
                    t.event,
                    t.channel,
                    t.channel === "email" ? { email_subject: subject, email_body: body } : {},
                  ),
                );
              } catch (e) {
                setError(ispErrorMessage(e));
              }
            }}
          >
            Preview
          </MButton>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton disabled={busy} onClick={save}>
            {busy && <Spinner />} Save
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Variables, in this order: {t.variables.map((v) => `{{${v}}}`).join(", ")}.
          {!t.wired && " This event is stored and previewed but not sent automatically yet."}
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{" "}
          On
        </label>
        {t.channel === "email" ? (
          <>
            <TextField label="Subject" value={subject} onChange={setSubject} />
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Body</span>
              <textarea
                className={`${M_INPUT} min-h-[140px] font-mono text-xs`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            {unknown.length > 0 && (
              <p className="text-xs text-destructive">Unknown: {unknown.join(", ")}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Only templates approved in your own WhatsApp Business account can be used; we check
              with Meta when you save. Free text is never sent.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Approved template name" value={name} onChange={setName} />
              <TextField
                label="Language code"
                value={lang}
                onChange={setLang}
                hint="e.g. en, hi, en_US"
              />
            </div>
            {t.wa_approval_status && (
              <p className="text-xs">
                Meta status at last check:{" "}
                <MTag
                  label={t.wa_approval_status}
                  tone={t.wa_approval_status === "APPROVED" ? "online" : "pending"}
                />{" "}
                <span className="text-muted-foreground">{t.wa_checked_ist}</span>
              </p>
            )}
          </>
        )}
        {preview && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
            {preview.channel === "email" ? (
              <>
                <p className="font-semibold">{preview.subject}</p>
                <p className="mt-1 whitespace-pre-wrap">{preview.body}</p>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  {preview.template_name ?? "(no template)"} · {preview.language ?? "–"}
                </p>
                <ol className="mt-1 list-decimal pl-4">
                  {preview.parameters.map((p) => (
                    <li key={p.position}>
                      {p.variable}: {p.sample}
                    </li>
                  ))}
                </ol>
                <p className="mt-1 text-muted-foreground">{preview.note}</p>
              </>
            )}
          </div>
        )}
        <FormError message={error} />
      </div>
    </MDialog>
  );
}

function TemplatesView() {
  const { can } = usePartner();
  const q = useQuery({
    queryKey: ck("templates"),
    queryFn: () => commsService.templates(),
    retry: retryUnless4xx,
  });
  const [open, setOpen] = useState<CommsTemplate | null>(null);
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="templates" />;
  return (
    <Card title="Templates">
      <p className="mb-3 text-xs text-muted-foreground">{q.data.rules}</p>
      <MTable
        head={
          <>
            <MTh>Event</MTh>
            <MTh>Channel</MTh>
            <MTh>Template</MTh>
            <MTh>Sent automatically</MTh>
            <MTh>Status</MTh>
            <MTh className="text-right">Action</MTh>
          </>
        }
      >
        {q.data.items.map((t) => (
          <MTr key={`${t.event}-${t.channel}`}>
            <MTd className="text-xs font-medium">{t.label}</MTd>
            <MTd className="text-xs">{t.channel === "whatsapp" ? "WhatsApp" : "Email"}</MTd>
            <MTd className="text-xs">
              {t.channel === "whatsapp" ? (t.wa_template_name ?? "–") : (t.email_subject ?? "–")}
            </MTd>
            <MTd className="text-xs">{t.wired ? "Yes" : "Not yet"}</MTd>
            <MTd>
              <MTag label={t.enabled ? "On" : "Off"} tone={t.enabled ? "online" : undefined} />
            </MTd>
            <MTd className="text-right">
              <MButton
                variant="ghost"
                onClick={() => setOpen(t)}
                disabled={!can("isp_billing.manage")}
              >
                Edit
              </MButton>
            </MTd>
          </MTr>
        ))}
      </MTable>
      {open && <TemplateDialog t={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function WebhookView() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ck("webhook"),
    queryFn: () => commsService.webhook(),
    retry: retryUnless4xx,
  });
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="the webhook" />;
  const w = q.data;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ck("webhook") });
      setSecret("");
      toast.success(msg);
    } catch (e) {
      setError(ispErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Delivery receipts (Meta webhook)">
      <p className="mb-3 text-xs text-muted-foreground">
        Add this callback in your Meta app (WhatsApp → Configuration) and subscribe to message
        status updates. Delivered and read only show once Meta reports them here.
      </p>
      {w.configured && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <CopyField label="Callback URL" value={`${origin}${w.callback_path}`} />
          <CopyField label="Verify token" value={w.verify_token} secret />
          <p className="text-xs">
            App secret: {w.app_secret_set ? "set" : "not set (callbacks are refused)"} · Last
            callback: {w.last_received_ist ?? "none yet"} · Refused: {w.rejected_count ?? 0}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-72">
          <TextField
            label="Meta app secret"
            type="password"
            value={secret}
            onChange={setSecret}
            hint="Signs every callback; stored encrypted."
          />
        </div>
        <MButton
          disabled={busy || (!secret && w.configured)}
          onClick={() => act(() => commsService.saveWebhook(secret || null), "Webhook saved.")}
        >
          {busy && <Spinner />} {w.configured ? "Save secret" : "Set up"}
        </MButton>
        {w.configured && (
          <MButton
            variant="outline"
            disabled={busy}
            onClick={() =>
              act(() => commsService.rotateWebhook(), "New callback URL and verify token.")
            }
          >
            <RefreshCw /> Rotate URL
          </MButton>
        )}
      </div>
      <FormError message={error} />
    </Card>
  );
}

export function CommsHub({ fallback }: { fallback: ReactNode }) {
  const { can } = usePartner();
  const probe = useQuery({
    queryKey: ck("templates"),
    queryFn: () => commsService.templates(),
    retry: retryUnless4xx,
  });
  const [section, setSection] = useState<Section>("logs");
  if (probe.isLoading) return <LoadingBlock />;
  if (ispErrorStatus(probe.error) === 404) return <>{fallback}</>;
  const options: { value: Section; label: string }[] = [
    { value: "logs", label: "Messages" },
    { value: "templates", label: "Templates" },
  ];
  if (can("isp_billing.manage")) options.push({ value: "webhook", label: "Delivery receipts" });
  return (
    <div className="space-y-3">
      <MSeg<Section>
        className={PAGE_TABS}
        value={section}
        onChange={setSection}
        options={options}
      />
      {section === "logs" && <LogsView />}
      {section === "templates" && <TemplatesView />}
      {section === "webhook" && <WebhookView />}
    </div>
  );
}
