import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaveProvider } from "@/hooks/useMarketing";
import { marketingErrorCode, marketingErrorData } from "@/services/marketing.service";
import {
  buildProviderPut,
  initialProviderValues,
  isSecretHint,
  providerTypeDef,
  providerTypesFor,
  secretPlaceholder,
  type Channel,
  type SecretHintLike,
} from "@/lib/marketing-providers";
import type { MarketingChannel, ProviderView } from "@/types/marketing";
import { marketingErrorMessage, useChannelLabel } from "../marketing-helpers";

/**
 * Add or edit the venue's own provider for one channel (spec §12.6).
 *
 * SECRETS: every secret input renders EMPTY -- never prefilled, never
 * echoed. The server's `{set, hint}` becomes the placeholder "Saved (…a1b2).
 * Leave blank to keep.", and a blank secret is left out of the PUT so the
 * stored one is kept (`buildProviderPut`). The form's state, secrets
 * included, is discarded on close and after every submit.
 */
export function ProviderForm({
  channel,
  own,
  open,
  onOpenChange,
}: {
  channel: MarketingChannel;
  own: ProviderView | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const label = useChannelLabel();
  const save = useSaveProvider();
  const types = providerTypesFor(channel as Channel);
  const [type, setType] = useState<string>(
    own?.provider_type ?? types.find((t) => t.available)?.type ?? "",
  );
  const def = providerTypeDef(type);
  const storedDisplay = own && own.provider_type === type ? own.display : null;
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Fresh state on every opening and type change: nothing typed survives a
  // close, secrets least of all.
  useEffect(() => {
    if (!open) {
      setValues({});
      return;
    }
    setFieldErrors({});
    setError(null);
    if (def) setValues(initialProviderValues(def, storedDisplay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  useEffect(() => {
    if (open) setType(own?.provider_type ?? types.find((t) => t.available)?.type ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const replacing = !!own && own.provider_type !== type;
  const hints = useMemo(() => {
    const out: Record<string, SecretHintLike | undefined> = {};
    for (const [k, v] of Object.entries(storedDisplay ?? {})) if (isSecretHint(v)) out[k] = v;
    return out;
  }, [storedDisplay]);

  const submit = async () => {
    if (!def) return;
    setError(null);
    const built = buildProviderPut(
      def,
      values,
      own ? { provider_type: own.provider_type, display: own.display } : null,
    );
    setFieldErrors(built.errors);
    if (!built.body) return;
    if (own && !replacing && Object.keys(built.body.config).length === 0) {
      toast.message("Nothing changed.");
      onOpenChange(false);
      return;
    }
    try {
      const saved = await save.mutateAsync({ channel, body: built.body as never });
      toast.success(
        saved.status === "verified"
          ? "Provider saved."
          : "Provider saved. Verify it before campaigns can send through it.",
      );
      setValues({});
      onOpenChange(false);
    } catch (err) {
      if (marketingErrorCode(err) === "provider_config_invalid") {
        const f = marketingErrorData(err)?.fields;
        if (f && typeof f === "object") setFieldErrors(f as Record<string, string>);
      }
      setError(marketingErrorMessage(err, "Couldn't save the provider."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {own ? `Your own ${label(channel)} provider` : `Use your own ${label(channel)} account`}
          </DialogTitle>
          <DialogDescription>
            Saved settings take effect only after the provider is verified and turned on. Until then{" "}
            {label(channel)} keeps sending through Wyfy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Provider</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Provider">
              <SelectValue placeholder="Choose a provider" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.type} value={t.type} disabled={!t.available}>
                  {t.label}
                  {!t.available ? " (coming soon)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {replacing && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Switching provider replaces the saved one; fill in every field, including secrets.
            </p>
          )}
        </div>

        {def && (
          <div className="space-y-3">
            {def.fields.map((f) => {
              const id = `pf-${f.key}`;
              const err = fieldErrors[f.key];
              if (f.kind === "boolean") {
                return (
                  <label key={f.key} className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={values[f.key] === "true"}
                      onCheckedChange={(v) =>
                        setValues((p) => ({ ...p, [f.key]: v ? "true" : "false" }))
                      }
                    />
                    {f.label}
                  </label>
                );
              }
              return (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={id}>
                    {f.label}
                    {f.secret && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(secret)</span>
                    )}
                  </Label>
                  {f.kind === "select" ? (
                    <Select
                      value={values[f.key] ?? ""}
                      onValueChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))}
                    >
                      <SelectTrigger id={id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options?.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={id}
                      type={f.secret ? "password" : f.kind === "email" ? "email" : "text"}
                      // Never prefilled: see this component's doc comment.
                      value={values[f.key] ?? ""}
                      placeholder={
                        f.secret && !replacing ? secretPlaceholder(hints[f.key]) : undefined
                      }
                      autoComplete={f.secret ? "new-password" : "off"}
                      data-secret={f.secret ? "true" : undefined}
                      aria-invalid={err ? true : undefined}
                      onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                  {err ? (
                    <p className="text-[11px] text-red-600">{err}</p>
                  ) : f.help ? (
                    <p className="text-[11px] text-muted-foreground">{f.help}</p>
                  ) : null}
                </div>
              );
            })}
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending || !def?.available}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
