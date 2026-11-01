/**
 * KYC + CAF for one subscriber (J6). Self-contained so the Subscriber 360
 * page (JAZE-1) can mount it as a tab: `<SubscriberKycPanel subscriberId=… />`.
 *
 * The Aadhaar number typed here is sent once and the backend keeps only its
 * last four digits; the field is cleared after saving and never pre-filled.
 */
import { useEffect, useState } from "react";
import { MButton, MTag, M_INPUT } from "@/components/master/MasterKit";
import { Card, ErrorBlock, FormError, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { useComplianceMutation, useSubscriberKyc } from "@/hooks/isp-partner/useCompliance";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { complianceService, type KycRecord } from "@/services/isp-partner/compliance";
import { M_FILTER } from "@/components/isp-partner/ui/classes";

const ID_LABEL: Record<string, string> = {
  aadhaar: "Aadhaar",
  voter_id: "Voter ID",
  passport: "Passport",
  pan: "PAN card",
  driving_licence: "Driving licence",
  ration_card: "Ration card",
  other: "Other",
};
const DOC_LABEL: Record<string, string> = {
  photo: "Photo",
  signature: "Signature",
  id_proof: "ID proof",
  address_proof: "Address proof",
  caf_signed: "Signed CAF (paper)",
  install_report: "Installation report",
};

type Form = Partial<Record<keyof KycRecord, string | boolean | null>> & { id_number?: string };

const TEXT_FIELDS: { key: keyof KycRecord; label: string; area?: boolean }[] = [
  { key: "full_name", label: "Name as on ID" },
  { key: "father_or_spouse_name", label: "Father's / spouse's name" },
  { key: "date_of_birth", label: "Date of birth (YYYY-MM-DD)" },
  { key: "nationality", label: "Nationality" },
  { key: "alternate_phone", label: "Alternate mobile" },
  { key: "permanent_address", label: "Permanent / billing address", area: true },
  { key: "installation_address", label: "Installation address", area: true },
  { key: "installation_pincode", label: "Installation PIN code" },
  { key: "notes", label: "Notes", area: true },
];

export function SubscriberKycPanel({ subscriberId }: { subscriberId: string }) {
  const { can } = usePartner();
  const editable = can("isp_partner.update");
  const exportable = can("isp_partner.export");
  const q = useSubscriberKyc(subscriberId);
  const [form, setForm] = useState<Form>({});
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kind, setKind] = useState("id_proof");
  const [customCaf, setCustomCaf] = useState("");

  useEffect(() => {
    const k = q.data?.kyc;
    setForm(k ? { ...k, id_number: "" } : { applicant_type: "individual", id_number: "" });
  }, [q.data]);

  const save = useComplianceMutation((body: Record<string, unknown>) =>
    complianceService.saveKyc(subscriberId, body),
  );
  const upload = useComplianceMutation((f: File) =>
    complianceService.uploadDocument(subscriberId, kind, f),
  );
  const remove = useComplianceMutation((id: string) =>
    complianceService.deleteDocument(subscriberId, id),
  );
  const caf = useComplianceMutation((n: string) =>
    complianceService.assignCaf(subscriberId, n || undefined),
  );

  if (q.isLoading) return <LoadingBlock />;
  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="KYC" />;
  const data = q.data!;
  const kyc = data.kyc;

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const onSave = async (verified?: boolean) => {
    setErr(null);
    setNotice(null);
    const body: Record<string, unknown> = {};
    for (const f of TEXT_FIELDS) body[f.key] = (form[f.key] as string) ?? null;
    body.applicant_type = form.applicant_type ?? "individual";
    body.gender = form.gender || null;
    body.address_proof_same_as_id = form.address_proof_same_as_id !== false;
    body.address_proof_type =
      form.address_proof_same_as_id === false ? form.address_proof_type || null : null;
    if (form.id_proof_type) body.id_proof_type = form.id_proof_type;
    if (form.id_number) body.id_number = form.id_number;
    if (verified !== undefined) body.verified = verified;
    try {
      await save.mutateAsync(body);
      setForm((f) => ({ ...f, id_number: "" }));
      setNotice("Saved.");
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };

  const onPdf = async () => {
    setErr(null);
    try {
      const f = await complianceService.cafPdf(subscriberId);
      saveBlob(f.blob, f.filename);
      q.refetch();
    } catch (e) {
      setErr(ispErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="KYC"
        actions={
          kyc?.verified_at ? (
            <MTag label={`Verified ${formatDateTime(kyc.verified_at)}`} tone="active" />
          ) : (
            <MTag label="Not verified" tone="pending" />
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Applicant type
            <select
              className={M_INPUT}
              disabled={!editable}
              value={(form.applicant_type as string) ?? "individual"}
              onChange={(e) => set("applicant_type", e.target.value)}
            >
              <option value="individual">Individual</option>
              <option value="organization">Organisation</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Gender
            <select
              className={M_INPUT}
              disabled={!editable}
              value={(form.gender as string) ?? ""}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="">Not given</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="undisclosed">Prefer not to say</option>
            </select>
          </label>
          {TEXT_FIELDS.map((f) => (
            <label
              key={f.key}
              className={`text-xs text-muted-foreground ${f.area ? "sm:col-span-2" : ""}`}
            >
              {f.label}
              {f.area ? (
                <textarea
                  className={M_INPUT}
                  rows={2}
                  disabled={!editable}
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  className={M_INPUT}
                  disabled={!editable}
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
          <label className="text-xs text-muted-foreground">
            ID proof
            <select
              className={M_INPUT}
              disabled={!editable}
              value={(form.id_proof_type as string) ?? ""}
              onChange={(e) => set("id_proof_type", e.target.value)}
            >
              <option value="">Pick…</option>
              {data.id_types.map((t) => (
                <option key={t} value={t}>
                  {ID_LABEL[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            ID number {kyc?.id_number ? `(on file: ${kyc.id_number})` : ""}
            <input
              className={M_INPUT}
              disabled={!editable || !form.id_proof_type}
              autoComplete="off"
              placeholder={
                form.id_proof_type === "aadhaar"
                  ? "12 digits; only the last 4 are kept"
                  : "Leave blank to keep the number on file"
              }
              value={(form.id_number as string) ?? ""}
              onChange={(e) => set("id_number", e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <input
              type="checkbox"
              disabled={!editable}
              checked={form.address_proof_same_as_id !== false}
              onChange={(e) => set("address_proof_same_as_id", e.target.checked)}
            />
            The ID proof is also the address proof
          </label>
          {form.address_proof_same_as_id === false && (
            <label className="text-xs text-muted-foreground">
              Address proof
              <select
                className={M_INPUT}
                disabled={!editable}
                value={(form.address_proof_type as string) ?? ""}
                onChange={(e) => set("address_proof_type", e.target.value)}
              >
                <option value="">Pick…</option>
                {data.id_types.map((t) => (
                  <option key={t} value={t}>
                    {ID_LABEL[t] ?? t}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <FormError message={err} />
        {notice && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>}
        {editable && (
          <div className="mt-3 flex flex-wrap gap-2">
            <MButton onClick={() => onSave()} disabled={save.isPending}>
              Save
            </MButton>
            {kyc?.verified_at ? (
              <MButton variant="outline" onClick={() => onSave(false)} disabled={save.isPending}>
                Mark not verified
              </MButton>
            ) : (
              <MButton variant="outline" onClick={() => onSave(true)} disabled={save.isPending}>
                Save and mark verified
              </MButton>
            )}
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Aadhaar numbers are never stored in full: only the last four digits are kept, as the
          Aadhaar Act requires. Keep the signed paper form or upload it below.
        </p>
      </Card>

      <Card title="Documents">
        {data.documents.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        )}
        <ul className="divide-y divide-border">
          {data.documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="font-medium">{DOC_LABEL[d.kind] ?? d.kind}</span>
              <span className="truncate text-muted-foreground">{d.filename}</span>
              <span className="text-xs text-muted-foreground">
                {Math.ceil(d.size_bytes / 1024)} KB · {formatDateTime(d.uploaded_at)}
              </span>
              <span className="ml-auto flex gap-2">
                {exportable && (
                  <MButton
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const f = await complianceService.downloadDocument(subscriberId, d);
                        saveBlob(f.blob, f.filename);
                      } catch (e) {
                        setErr(ispErrorMessage(e));
                      }
                    }}
                  >
                    Download
                  </MButton>
                )}
                {editable && (
                  <MButton
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => {
                      setErr(null);
                      remove.mutate(d.id, { onError: (e) => setErr(ispErrorMessage(e)) });
                    }}
                  >
                    Remove
                  </MButton>
                )}
              </span>
            </li>
          ))}
        </ul>
        {editable && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <select
              className={`${M_FILTER}`}
              aria-label="Document type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {data.document_kinds.map((k) => (
                <option key={k} value={k}>
                  {DOC_LABEL[k] ?? k}
                </option>
              ))}
            </select>
            <input
              type="file"
              aria-label="File"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="text-sm"
              disabled={upload.isPending}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setErr(null);
                try {
                  await upload.mutateAsync(file);
                } catch (ex) {
                  setErr(ispErrorMessage(ex));
                }
              }}
            />
            <span className="text-[11px] text-muted-foreground">
              JPEG, PNG, WebP or PDF, up to 5 MB.
            </span>
          </div>
        )}
      </Card>

      <Card title="Customer application form (CAF)">
        <p className="text-sm">
          CAF number: <span className="font-medium">{kyc?.caf_number ?? "not assigned yet"}</span>
          {kyc?.caf_number_source && (
            <span className="text-muted-foreground">
              {" "}
              ({kyc.caf_number_source === "auto" ? "automatic" : "from the paper form"})
            </span>
          )}
          {kyc?.caf_generated_at && (
            <span className="text-muted-foreground">
              {" "}
              · last generated {formatDateTime(kyc.caf_generated_at)}
            </span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {editable && !kyc?.caf_number && (
            <MButton
              variant="outline"
              disabled={caf.isPending}
              onClick={() => {
                setErr(null);
                caf.mutate("", { onError: (e) => setErr(ispErrorMessage(e)) });
              }}
            >
              Assign next CAF number
            </MButton>
          )}
          {editable && (
            <>
              <input
                className={`${M_INPUT} w-48`}
                aria-label="Paper CAF number"
                placeholder="Paper form number"
                value={customCaf}
                onChange={(e) => setCustomCaf(e.target.value)}
              />
              <MButton
                variant="outline"
                disabled={!customCaf.trim() || caf.isPending}
                onClick={async () => {
                  setErr(null);
                  try {
                    await caf.mutateAsync(customCaf.trim());
                    setCustomCaf("");
                  } catch (e) {
                    setErr(ispErrorMessage(e));
                  }
                }}
              >
                Use paper number
              </MButton>
            </>
          )}
          {exportable && (
            <MButton onClick={onPdf} disabled={!kyc}>
              Download CAF PDF
            </MButton>
          )}
        </div>
        {!kyc && <p className="mt-2 text-xs text-muted-foreground">Save the KYC details first.</p>}
      </Card>
    </div>
  );
}
