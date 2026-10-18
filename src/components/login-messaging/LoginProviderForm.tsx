import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSaveLoginProvider } from "@/hooks/useLoginMessaging";
import { requestErrorOf } from "@/services/api";
import {
  buildPut,
  initialValues,
  secretPlaceholder,
  type FormValues,
  type HeaderRow,
} from "@/lib/login-messaging-form";
import type {
  AdapterField,
  AdapterSchema,
  LoginChannel,
  LoginMessagingTarget,
  LoginProviderView,
} from "@/types/login-messaging";
import { LayerDialog } from "./LayerDialog";
import { CHANNEL_LABEL, loginMessagingError } from "./login-messaging-copy";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Connect or edit the account that sends login codes on one channel. The
 * vendor list and every field come from the backend registry
 * (`adapters[channel]`); nothing here is vendor-specific.
 */
export function LoginProviderForm({
  target,
  channel,
  adapters,
  own,
  open,
  onOpenChange,
}: {
  target: LoginMessagingTarget;
  channel: LoginChannel;
  adapters: AdapterSchema[];
  own: LoginProviderView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveLoginProvider(target);
  const [type, setType] = useState(own?.provider_type ?? adapters[0]?.key ?? "");
  const schema = useMemo(() => adapters.find((a) => a.key === type), [adapters, type]);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setType(own?.provider_type ?? adapters[0]?.key ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fresh state on every opening and vendor change: nothing typed survives a
  // close, secrets least of all.
  useEffect(() => {
    setErrors({});
    setError(null);
    setValues(open && schema ? initialValues(schema, own) : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  const replacing = !!own && own.provider_type !== type;

  const submit = async () => {
    if (!schema) return;
    setError(null);
    const built = buildPut(schema, values, own);
    setErrors(built.errors);
    if (!built.body) return;
    try {
      await save.mutateAsync({ channel, body: built.body });
      toast.success("Saved. Verify it to start sending login codes through it.");
      setValues({});
      onOpenChange(false);
    } catch (err) {
      const fields = requestErrorOf(err)?.data?.fields;
      if (fields && typeof fields === "object") setErrors(fields as Record<string, string>);
      setError(loginMessagingError(err, "Couldn't save the provider."));
    }
  };

  const set = (name: string, v: FormValues[string]) => setValues((p) => ({ ...p, [name]: v }));

  return (
    <LayerDialog
      open={open}
      onOpenChange={(o) => !save.isPending && onOpenChange(o)}
      title={`${CHANNEL_LABEL[channel]} login codes: your own provider`}
      description={`Saved settings are used only after you verify them. Until then guests get their ${CHANNEL_LABEL[channel]} codes from Wyfy Guest.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={save.isPending || !schema}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="lm-provider">Provider</Label>
        <select
          id="lm-provider"
          className={selectClass}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {adapters.map((a) => (
            <option key={a.key} value={a.key}>
              {a.display_name}
            </option>
          ))}
        </select>
        {schema?.notes && <p className="text-[11px] text-muted-foreground">{schema.notes}</p>}
        {schema?.docs_url && (
          <a
            href={schema.docs_url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11px] text-primary hover:underline"
          >
            {schema.display_name} API docs
          </a>
        )}
        {replacing && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            Switching provider replaces the saved one; fill in every field, including secrets.
          </p>
        )}
      </div>

      {schema && (
        <div className="space-y-3">
          {schema.fields.map((f) => (
            <FieldInput
              key={`${schema.key}-${f.name}`}
              field={f}
              value={values[f.name]}
              stored={own && !replacing ? own.display[f.name] : undefined}
              error={errors[f.name]}
              onChange={(v) => set(f.name, v)}
            />
          ))}
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
    </LayerDialog>
  );
}

function FieldInput({
  field: f,
  value,
  stored,
  error,
  onChange,
}: {
  field: AdapterField;
  value: FormValues[string] | undefined;
  stored: unknown;
  error?: string;
  onChange: (v: FormValues[string]) => void;
}) {
  const id = `lm-${f.name}`;
  const hint = error ? (
    <p className="text-[11px] text-red-600">{error}</p>
  ) : f.help ? (
    <p className="text-[11px] text-muted-foreground">{f.help}</p>
  ) : null;

  if (f.kind === "boolean") {
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={value === true} onCheckedChange={(v) => onChange(v)} />
          {f.label}
        </label>
        {hint}
      </div>
    );
  }
  if (f.kind === "headers") {
    return (
      <HeadersInput field={f} rows={(value as HeaderRow[]) ?? []} onChange={onChange} hint={hint} />
    );
  }
  const text = typeof value === "string" ? value : "";
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {f.label}
        {!f.required && <span className="ml-1 text-[10px] text-muted-foreground">(optional)</span>}
        {f.kind === "secret" && (
          <span className="ml-1 text-[10px] text-muted-foreground">(secret)</span>
        )}
      </Label>
      {f.kind === "select" ? (
        <select
          id={id}
          className={selectClass}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        >
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.kind === "textarea" ? (
        <Textarea
          id={id}
          rows={3}
          value={text}
          maxLength={f.max_length}
          placeholder={f.placeholder || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={f.kind === "secret" ? "password" : "text"}
          // A secret is never prefilled; the saved hint is only a placeholder.
          value={text}
          maxLength={f.max_length}
          placeholder={f.kind === "secret" ? secretPlaceholder(stored) : f.placeholder || undefined}
          autoComplete={f.kind === "secret" ? "new-password" : "off"}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint}
    </div>
  );
}

function HeadersInput({
  field,
  rows,
  onChange,
  hint,
}: {
  field: AdapterField;
  rows: HeaderRow[];
  onChange: (v: HeaderRow[]) => void;
  hint: React.ReactNode;
}) {
  const update = (i: number, patch: Partial<HeaderRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-1.5">
      <Label>{field.label}</Label>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-1.5">
          <Input
            aria-label="Header name"
            placeholder="Header"
            value={r.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <Input
            aria-label={`${r.name || "Header"} value`}
            type={r.secret ? "password" : "text"}
            placeholder={r.secret && r.stored?.set ? `Saved (${r.stored.hint})` : "Value"}
            autoComplete={r.secret ? "new-password" : "off"}
            value={r.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <label className="flex items-center gap-1 text-[11px]">
            <Switch
              checked={r.secret}
              onCheckedChange={(v) => update(i, { secret: v, stored: undefined })}
              aria-label="Secret"
            />
            Secret
          </label>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remove header"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...rows, { name: "", value: "", secret: false }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add header
      </Button>
      {hint}
    </div>
  );
}
