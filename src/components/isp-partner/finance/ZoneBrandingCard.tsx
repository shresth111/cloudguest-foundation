/**
 * BILL-2: per-zone invoice branding. "Billed through" name and the bank /
 * UPI block printed on this zone's invoices instead of the ISP's. The
 * supplier header (legal name, GSTIN) stays the ISP's. Hidden while the BE
 * flag is off (the GET answers 404).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MButton } from "@/components/master/MasterKit";
import { FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage, ispFieldErrors } from "@/lib/isp-partner/errors";
import {
  bill2Service,
  type ZoneBranding,
  type ZoneBrandingBody,
} from "@/services/isp-partner/bill2";

const FIELDS: { key: keyof ZoneBrandingBody; label: string; hint?: string }[] = [
  {
    key: "invoice_name",
    label: "Billed through (name on invoices)",
    hint: "Empty: the zone name.",
  },
  { key: "bank_account_name", label: "Account name" },
  { key: "bank_name", label: "Bank" },
  { key: "bank_account_number", label: "Account number" },
  { key: "bank_ifsc", label: "IFSC", hint: "Like HDFC0001234" },
  { key: "bank_branch", label: "Branch" },
  { key: "upi_vpa", label: "UPI id", hint: "Used for the pay QR on this zone's invoices." },
];

const empty = (b?: ZoneBranding): Record<keyof ZoneBrandingBody, string> =>
  Object.fromEntries(FIELDS.map((f) => [f.key, (b?.[f.key] as string | null) ?? ""])) as Record<
    keyof ZoneBrandingBody,
    string
  >;

export function ZoneBrandingCard({ zoneId, editable }: { zoneId: string; editable: boolean }) {
  const qc = useQueryClient();
  const key = ["isp", "bill2", "branding", zoneId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => bill2Service.branding(zoneId),
    retry: retryUnless4xx,
  });
  const [form, setForm] = useState(() => empty());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.data) setForm(empty(q.data));
  }, [q.data]);
  const save = useMutation({
    mutationFn: () =>
      bill2Service.saveBranding(
        zoneId,
        Object.fromEntries(
          FIELDS.map((f) => [f.key, form[f.key].trim() || null]),
        ) as ZoneBrandingBody,
      ),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      setErrors({});
      setError(null);
      toast.success("Invoice branding saved.");
    },
    onError: (e) => {
      setErrors(ispFieldErrors(e));
      setError(ispErrorMessage(e, "Could not save the branding."));
    },
  });

  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return null; // flag off (404) or no access

  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-foreground">Invoice branding</legend>
      <p className="text-[11px] text-muted-foreground">
        Printed on invoices of subscribers in this zone. The bank and UPI details replace yours on
        those invoices; your legal name and GSTIN stay as the supplier.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={form[f.key]}
            onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
            disabled={!editable}
            error={errors[f.key]}
            hint={f.hint}
          />
        ))}
      </div>
      <FormError message={error} />
      {editable && (
        <div className="flex justify-end">
          <MButton onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Spinner />} Save branding
          </MButton>
        </div>
      )}
    </fieldset>
  );
}
