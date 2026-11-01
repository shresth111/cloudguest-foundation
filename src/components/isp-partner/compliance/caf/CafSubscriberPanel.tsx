/** One subscriber's CAF (CAF-2): what will be printed (read-only, from
 * JAZE-1/3 data), the CAF-only fields, the CAF number and the PDF. */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ListPlus } from "lucide-react";
import { MButton, MSeg, MTag } from "@/components/master/MasterKit";
import {
  Card,
  ErrorBlock,
  FormError,
  LoadingBlock,
  Spinner,
  TextField,
} from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { CafExtrasFields } from "@/components/isp-partner/compliance/caf/CafExtrasFields";
import { saveBlob } from "@/lib/isp-partner/download";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import {
  MISSING_LABEL,
  addressLine,
  customNumberError,
  extrasBody,
  extrasDraft,
  maskTwelveDigits,
  pdfBlocked,
} from "@/lib/isp-partner/caf";
import {
  cafService,
  type ApplicantCategory,
  type CafSubscriberPrefill,
} from "@/services/isp-partner/caf";

const ID_LABEL: Record<string, string> = {
  aadhaar: "Aadhaar",
  voter_id: "Voter ID",
  passport: "Passport",
  pan: "PAN",
  driving_licence: "Driving licence",
  ration_card: "Ration card",
  other: "Other",
};

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{maskTwelveDigits(v) || "–"}</dd>
    </>
  );
}

export function CafSubscriberPanel({
  subscriberId,
  categories,
  onAddToExport,
}: {
  subscriberId: string;
  categories: ApplicantCategory[];
  onAddToExport: (id: string, label: string) => void;
}) {
  const q = useQuery({
    queryKey: ["isp", "caf", "subscriber", subscriberId],
    queryFn: () => cafService.subscriber(subscriberId),
    retry: false,
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data)
    return <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="this subscriber" />;
  return <Body data={q.data} categories={categories} onAddToExport={onAddToExport} />;
}

function Body({
  data,
  categories,
  onAddToExport,
}: {
  data: CafSubscriberPrefill;
  categories: ApplicantCategory[];
  onAddToExport: (id: string, label: string) => void;
}) {
  const { can } = usePartner();
  const qc = useQueryClient();
  const s = data.subscriber;
  const k = data.kyc;
  const editable = can("isp_partner.update");
  const [draft, setDraft] = useState(() => extrasDraft(data.extras));
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "number" | "pdf">("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["isp", "caf"] });
  const run = async (what: typeof busy, fn: () => Promise<unknown>, done?: string) => {
    setErr(null);
    setBusy(what);
    try {
      await fn();
      if (done) toast.success(done);
    } catch (e) {
      setErr(ispErrorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const label = `${s.name || s.username} (#${s.circuit_id})`;

  return (
    <div className="space-y-4">
      <Card
        title={s.name || s.username}
        actions={
          data.caf_number ? (
            <MTag label={`CAF ${data.caf_number}`} tone="active" />
          ) : (
            <MTag label="No CAF number yet" tone="pending" />
          )
        }
      >
        {data.missing.length > 0 && (
          <ul className="mb-3 space-y-0.5 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {data.missing.map((m) => (
              <li key={m}>{MISSING_LABEL[m] ?? m}</li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <Row k="Customer ID" v={s.username} />
          <Row k="Name" v={k?.full_name || s.name} />
          <Row k="Mobile / email" v={addressLine([s.phone, s.email])} />
          <Row
            k="Billing address"
            v={k?.permanent_address || addressLine([s.address, s.billing_city, s.billing_pincode])}
          />
          <Row
            k="Installation"
            v={
              k?.installation_address ||
              (s.install_same_as_billing
                ? "Same as billing"
                : addressLine([s.install_address, s.install_city, s.install_pincode]))
            }
          />
          <Row
            k="ID proof"
            v={
              k?.id_proof_type
                ? `${ID_LABEL[k.id_proof_type] ?? k.id_proof_type} · ${k.id_number ?? "no number"}`
                : null
            }
          />
          <Row
            k="Photo / signature"
            v={`${data.documents.photo ? "Photo on file" : "No photo"} · ${data.documents.signature ? "Signature on file" : "No signature"}`}
          />
          <Row k="Plan" v={addressLine([s.package_name, s.customer_name])} />
          {data.caf_generated_at && (
            <Row k="Last generated" v={formatDateTime(data.caf_generated_at)} />
          )}
        </dl>
      </Card>

      <Card title="CAF details">
        <CafExtrasFields
          draft={draft}
          onChange={setDraft}
          categories={categories}
          disabled={!editable}
        />
        {editable && (
          <MButton
            className="mt-3"
            variant="outline"
            disabled={busy !== ""}
            onClick={() => {
              const r = extrasBody(draft);
              if ("error" in r) return setErr(r.error);
              run(
                "save",
                async () => {
                  await cafService.saveSubscriberExtras(s.id, r.body);
                  refresh();
                },
                "Saved.",
              );
            }}
          >
            {busy === "save" && <Spinner />} Save details
          </MButton>
        )}
      </Card>

      <Card title="CAF number and PDF">
        {editable && !data.caf_number && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Number</span>
              <MSeg<"auto" | "custom">
                value={mode}
                onChange={setMode}
                options={[
                  { value: "auto", label: "Next in series" },
                  { value: "custom", label: "Own number" },
                ]}
              />
            </label>
            {mode === "custom" && (
              <TextField
                label="CAF number"
                value={custom}
                onChange={setCustom}
                hint="Must not be used by another subscriber."
              />
            )}
            <div className="sm:col-span-2">
              <MButton
                variant="outline"
                disabled={busy !== ""}
                onClick={() => {
                  if (mode === "custom") {
                    const e = customNumberError(custom);
                    if (e) return setErr(e);
                  }
                  run("number", async () => {
                    const r = await cafService.assignNumber(
                      s.id,
                      mode === "custom" ? { mode, number: custom.trim() } : { mode: "auto" },
                    );
                    toast.success(`CAF number ${r.caf_number}.`);
                    refresh();
                  });
                }}
              >
                {busy === "number" && <Spinner />} Assign
              </MButton>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {can("isp_partner.export") && (
            <MButton
              disabled={busy !== "" || pdfBlocked(data.missing)}
              title={pdfBlocked(data.missing) ? "Fill in KYC first" : undefined}
              onClick={() =>
                run("pdf", async () => {
                  const f = await cafService.pdf(s.id);
                  saveBlob(f.blob, f.filename);
                  refresh();
                })
              }
            >
              {busy === "pdf" ? <Spinner /> : <Download />} Download CAF PDF
            </MButton>
          )}
          {can("isp_partner.export") && (
            <MButton variant="outline" onClick={() => onAddToExport(s.id, label)}>
              <ListPlus /> Add to export list
            </MButton>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The ID number prints masked; an Aadhaar number shows only its last four digits.
          {!data.caf_number && " Downloading assigns the next number if none is set."}
        </p>
        <FormError message={err} />
      </Card>
    </div>
  );
}
