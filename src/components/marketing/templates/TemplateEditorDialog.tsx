import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTemplate, useTemplatePreview, useUpdateTemplate } from "@/hooks/useMarketing";
import { marketingErrorCode } from "@/services/marketing.service";
import { emailBodyIssues, isValidDltTemplateId, smsBodyIssues } from "@/lib/marketing-template";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_VARIABLES,
  type MarketingStatus,
  type MarketingTemplate,
  type TemplatePreviewRequest,
  type TemplateWritePayload,
} from "@/types/marketing";
import { SmsCounter } from "./SmsCounter";
import { EmailPreviewFrame } from "./EmailPreviewFrame";
import { channelStatusFor, marketingErrorMessage } from "../marketing-helpers";

const ISSUE_COPY: Record<string, string> = {
  unknown_variable:
    "Uses a variable that doesn't exist (or a stray {{ / }}). Use the buttons below.",
  unsubscribe_link_missing: "Must include {{unsubscribe_link}} so guests can opt out.",
  sms_raw_too_long: "Longer than 1,000 characters.",
  sms_too_long:
    "With long names and codes filled in this would exceed 3 SMS parts; the server will refuse it.",
  subject_required: "Add a subject.",
};

const VARIABLE_HINT: Record<string, string> = {
  guest_name: 'Guest\'s name ("there" if unknown)',
  venue_name: "Your organisation's name",
  location_name: "This venue's name",
  offer_code: "Set per campaign",
  offer_expiry: "Set per campaign",
  event_name: "Set per campaign",
  event_date: "Set per campaign",
  booking_link: "Set per campaign",
  review_link: "Your portal's review link",
  unsubscribe_link: "Required. Filled in by Wyfy per guest",
};

type Field = "sms" | "subject" | "preheader" | "email";

/**
 * Create or edit a CUSTOM template (spec §5.4, §6.1). System templates never
 * open here -- they are read-only and are duplicated first.
 *
 * Per-channel tabs. SMS and Email are editable in MVP; WhatsApp custom
 * templates need Meta approval and are Phase 2, so that tab says so instead
 * of offering a field whose save the server would refuse
 * (`whatsapp_custom_not_supported`).
 *
 * The variable buttons insert `{{name}}` at the cursor of whichever field
 * was last focused. The checks under each field mirror the server's for
 * live feedback; the server re-validates everything, and its error (mapped
 * from `data.error_code`) is what the dialog shows if it refuses.
 */
export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  status,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = new template. */
  template: MarketingTemplate | null;
  status: MarketingStatus;
  onSaved?: (t: MarketingTemplate) => void;
}) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const saving = create.isPending || update.isPending;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("custom");
  const [description, setDescription] = useState("");
  const [smsOn, setSmsOn] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [dlt, setDlt] = useState("");
  const [emailOn, setEmailOn] = useState(false);
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [html, setHtml] = useState("");
  const [tab, setTab] = useState<"sms" | "email" | "whatsapp">("sms");
  const [serverError, setServerError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const lastField = useRef<Field>("sms");
  const refs = {
    sms: useRef<HTMLTextAreaElement>(null),
    subject: useRef<HTMLInputElement>(null),
    preheader: useRef<HTMLInputElement>(null),
    email: useRef<HTMLTextAreaElement>(null),
  };

  // (Re)seed the form each time the dialog opens, from the server's copy.
  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setCategory(template?.category ?? "custom");
    setDescription(template?.description ?? "");
    setSmsOn(!!template?.sms || !template);
    setSmsBody(template?.sms?.body ?? "");
    setDlt(template?.sms?.dlt_template_id ?? "");
    setEmailOn(!!template?.email);
    setSubject(template?.email?.subject ?? "");
    setPreheader(template?.email?.preheader ?? "");
    setHtml(template?.email?.body_html ?? "");
    setTab(template && !template.sms && template.email ? "email" : "sms");
    setServerError(null);
    setConflict(false);
  }, [open, template]);

  const smsIssues = smsOn ? smsBodyIssues(smsBody) : [];
  const emailIssues = emailOn ? emailBodyIssues(subject, html) : [];
  const dltInvalid = smsOn && dlt.trim() !== "" && !isValidDltTemplateId(dlt.trim());
  // Blocking = issues the server would refuse outright. `sms_too_long` is
  // shown but not blocking: the client's worst-case estimate for variables
  // the contract gives no maximum for (review_link) may differ from the
  // server's, and the server's answer is the one that counts.
  const blocking = [...smsIssues.filter((i) => i !== "sms_too_long"), ...emailIssues];
  const canSave =
    !saving &&
    name.trim().length > 0 &&
    name.trim().length <= 120 &&
    (smsOn || emailOn) &&
    (!smsOn || smsBody.trim().length > 0) &&
    (!emailOn || html.trim().length > 0) &&
    !dltInvalid &&
    blocking.length === 0;

  const dltBodyChanged =
    !!template?.sms?.dlt_template_id && smsOn && smsBody !== (template.sms?.body ?? "");

  const smsStatus = channelStatusFor(status.channels, "sms");

  const insertVariable = (v: string) => {
    const field = lastField.current;
    const token = `{{${v}}}`;
    const el = refs[field].current;
    const setters: Record<Field, [string, (s: string) => void]> = {
      sms: [smsBody, setSmsBody],
      subject: [subject, setSubject],
      preheader: [preheader, setPreheader],
      email: [html, setHtml],
    };
    const [value, set] = setters[field];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    set(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + token.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  // Server-rendered preview of the channel being edited (§5.4 preview).
  const previewBody: TemplatePreviewRequest | null = useMemo(() => {
    if (!open) return null;
    if (tab === "sms" && smsOn && smsBody.trim()) {
      return {
        channel: "sms",
        template_id: null,
        content: { sms: { body: smsBody, dlt_template_id: dlt.trim() || null } },
        variables: {},
        location_id: null,
      };
    }
    if (tab === "email" && emailOn && html.trim() && subject.trim()) {
      return {
        channel: "email",
        template_id: null,
        content: {
          email: { subject, preheader: preheader.trim() || null, body_html: html },
        },
        variables: {},
        location_id: null,
      };
    }
    return null;
  }, [open, tab, smsOn, smsBody, dlt, emailOn, html, subject, preheader]);
  const preview = useTemplatePreview(previewBody);

  const save = async () => {
    setServerError(null);
    setConflict(false);
    const payload: TemplateWritePayload = {
      name: name.trim(),
      category,
      description: description.trim() || null,
      sms: smsOn ? { body: smsBody, dlt_template_id: dlt.trim() || null } : null,
      whatsapp: null,
      email: emailOn
        ? { subject: subject.trim(), preheader: preheader.trim() || null, body_html: html }
        : null,
    };
    try {
      const saved = template
        ? await update.mutateAsync({
            id: template.id,
            body: { ...payload, version: template.version },
          })
        : await create.mutateAsync(payload);
      toast.success(template ? "Template saved" : "Template created");
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      if (marketingErrorCode(err) === "version_conflict") setConflict(true);
      setServerError(marketingErrorMessage(err, "Couldn't save the template."));
    }
  };

  const Issues = ({ list }: { list: string[] }) =>
    list.length ? (
      <ul className="space-y-0.5 text-[11px] text-red-600">
        {list.map((i) => (
          <li key={i}>{ISSUE_COPY[i] ?? i}</li>
        ))}
      </ul>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? `Edit “${template.name}”` : "New template"}</DialogTitle>
          <DialogDescription>
            Write the message once per channel. Variables are filled in for each guest when the
            campaign is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mt-name">Name</Label>
            <Input
              id="mt-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c === "winback" ? "Win-back" : c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-desc">Description (optional)</Label>
            <Input
              id="mt-desc"
              value={description}
              maxLength={300}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Insert a variable</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                title={VARIABLE_HINT[v]}
                onClick={() => insertVariable(v)}
                className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] hover:border-primary hover:bg-primary/5"
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="sms" className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={smsOn} onCheckedChange={setSmsOn} />
              Include an SMS version
            </label>
            {smsOn && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="mt-sms">SMS text</Label>
                  <Textarea
                    id="mt-sms"
                    ref={refs.sms}
                    rows={5}
                    value={smsBody}
                    onFocus={() => (lastField.current = "sms")}
                    onChange={(e) => setSmsBody(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <SmsCounter body={smsBody} />
                  <Issues list={smsIssues} />
                </div>
                {dltBodyChanged && (
                  <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    This template has a DLT template ID. Carriers drop SMS whose text doesn't match
                    the registered template exactly, so changing the text means registering it again
                    and updating the ID.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="mt-dlt">DLT template ID</Label>
                  <Input
                    id="mt-dlt"
                    inputMode="numeric"
                    value={dlt}
                    onChange={(e) => setDlt(e.target.value.replace(/\s/g, ""))}
                    aria-invalid={dltInvalid || undefined}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {dltInvalid
                      ? "Digits only, 12 to 30 of them."
                      : "Optional to save, required to send. It's the content template ID from your DLT registration; the text above must match it exactly (each {{variable}} is a {#var#})."}
                    {smsStatus && !smsStatus.configured && " SMS isn't live for your account yet."}
                  </p>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="email" className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={emailOn} onCheckedChange={setEmailOn} />
              Include an email version
            </label>
            {emailOn && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="mt-subject">Subject</Label>
                  <Input
                    id="mt-subject"
                    ref={refs.subject}
                    maxLength={150}
                    value={subject}
                    onFocus={() => (lastField.current = "subject")}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mt-pre">Preview line (optional)</Label>
                  <Input
                    id="mt-pre"
                    ref={refs.preheader}
                    maxLength={150}
                    value={preheader}
                    onFocus={() => (lastField.current = "preheader")}
                    onChange={(e) => setPreheader(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mt-html">Body (HTML)</Label>
                  <Textarea
                    id="mt-html"
                    ref={refs.email}
                    rows={8}
                    value={html}
                    onFocus={() => (lastField.current = "email")}
                    onChange={(e) => setHtml(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Basic formatting only (paragraphs, bold, links, lists, images). Scripts and
                    embedded frames are removed when you save. Wyfy adds your venue header and an
                    unsubscribe footer.
                  </p>
                  <Issues list={emailIssues} />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-3">
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Custom WhatsApp templates aren't available yet: every WhatsApp marketing message has
              to be approved by Meta first. Use one of the Wyfy templates for WhatsApp.
            </p>
          </TabsContent>
        </Tabs>

        {previewBody && (
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Preview with a sample guest
              {preview.isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            </p>
            {preview.isError ? (
              <p className="text-xs text-muted-foreground">
                {marketingErrorMessage(preview.error, "Preview unavailable.")}
              </p>
            ) : preview.data ? (
              <>
                {preview.data.rendered.subject && (
                  <p className="text-sm font-semibold">{preview.data.rendered.subject}</p>
                )}
                {preview.data.channel === "email" ? (
                  <EmailPreviewFrame html={preview.data.rendered.body} />
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {preview.data.rendered.body}
                  </p>
                )}
                {preview.data.missing_variables.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Filled in per campaign: {preview.data.missing_variables.join(", ")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Rendering…</p>
            )}
          </div>
        )}

        {serverError && (
          <p
            role="alert"
            className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
          >
            {serverError}
            {conflict && " Close this dialog and reopen the template to get the latest version."}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {saving ? "Saving…" : template ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
