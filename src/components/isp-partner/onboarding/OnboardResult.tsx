/**
 * After `POST /isp/onboarding` succeeded (ONBOARD-1): what was created, the
 * one-time PPPoE password, and step 2 -- the files, uploaded one by one to
 * the JAZE-3 document endpoint. The subscriber already exists at this
 * point, so a failed upload is shown on its own row with Retry; it never
 * undoes the subscriber.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, MessageCircle, RotateCw } from "lucide-react";
import { MButton, MTag } from "@/components/master/MasterKit";
import { Card, CopyField, Spinner } from "@/components/isp-partner/kit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatRupees } from "@/lib/isp-partner/money";
import { stepLabel, uploadPlan } from "@/lib/isp-partner/onboarding";
import { complianceService } from "@/services/isp-partner/compliance";
import { financeService } from "@/services/isp-partner/finance";
import type {
  OnboardingResult,
  PendingDocument,
  UploadState,
} from "@/services/isp-partner/onboarding-types";

const KIND_LABEL: Record<string, string> = {
  id_proof: "ID proof",
  address_proof: "Address proof",
  photo: "Photo",
  signature: "Signature",
  caf_signed: "Signed CAF",
  install_report: "Installation report",
};

export function OnboardResult({
  result,
  documents,
  canEmailInvoice,
  onAnother,
}: {
  result: OnboardingResult;
  documents: PendingDocument[];
  canEmailInvoice: boolean;
  onAnother: () => void;
}) {
  const s = result.subscriber;
  const plan = useRef(uploadPlan(documents)).current;
  const [uploads, setUploads] = useState<UploadState[]>(() =>
    plan.map((d) => ({ key: d.key, state: "waiting" })),
  );
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | string>("idle");
  const started = useRef(false);

  const upload = async (d: PendingDocument) => {
    setUploads((u) => u.map((x) => (x.key === d.key ? { key: d.key, state: "uploading" } : x)));
    try {
      const doc = await complianceService.uploadDocument(s.id, d.kind, d.file);
      setUploads((u) => u.map((x) => (x.key === d.key ? { key: d.key, state: "done", doc } : x)));
    } catch (e) {
      setUploads((u) =>
        u.map((x) =>
          x.key === d.key ? { key: d.key, state: "failed", error: ispErrorMessage(e) } : x,
        ),
      );
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      for (const d of plan) await upload(d); // one at a time: a slow link stays usable
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = uploads.filter((u) => u.state === "failed").length;
  const pending = uploads.filter((u) => u.state === "waiting" || u.state === "uploading").length;
  const name = [s.first_name, s.last_name].filter(Boolean).join(" ") || s.identifier;

  return (
    <div className="space-y-4">
      <Card title={`${name} is set up`}>
        <p className="mb-3 text-xs text-muted-foreground">
          Circuit #{s.circuit_id} · <span className="font-mono">{s.identifier}</span> ·{" "}
          {s.customer_name} · {s.package?.name}
        </p>
        <ul className="space-y-1 text-xs">
          {result.steps.map((st) => (
            <li key={st.step} className="flex items-center gap-2">
              {st.status === "done" ? (
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <span className="inline-block size-3.5 text-center text-muted-foreground">–</span>
              )}
              <span className={st.status === "done" ? "" : "text-muted-foreground"}>
                {stepLabel(st.step)}
                {st.detail ? ` · ${st.detail}` : st.status === "skipped" ? " · not asked for" : ""}
              </span>
            </li>
          ))}
        </ul>
        {result.static_queue_recorded && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            A static speed queue was recorded on the IP but not pushed to the router; the push is
            switched off on this platform.
          </p>
        )}
        {result.task && (
          <p className="mt-2 text-xs">
            Installation task created ({result.task.status}).{" "}
            <Link
              to="/partner/apps"
              search={{ tab: "tasks" }}
              className="text-primary hover:underline"
            >
              Open tasks
            </Link>
          </p>
        )}
        {result.invoice && (
          <p className="mt-2 text-xs">
            Invoice{" "}
            <Link
              to="/partner/invoices/$invoiceId"
              params={{ invoiceId: result.invoice.id }}
              className="font-mono hover:underline"
            >
              {result.invoice.number}
            </Link>{" "}
            for {formatRupees(result.invoice.total_paise)}
            {result.payment
              ? `, paid (receipt ${result.payment.receipt_number}).`
              : `, ${formatRupees(result.invoice.balance_paise)} due.`}
          </p>
        )}
        {result.pppoe?.password && (
          <div className="mt-3">
            <CopyField
              label="PPPoE password (shown once, give it to the subscriber)"
              value={result.pppoe.password}
            />
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/partner/subscribers/$subscriberId"
            params={{ subscriberId: s.id }}
            className="inline-flex"
          >
            <MButton>Open the subscriber</MButton>
          </Link>
          {s.welcome?.whatsapp_share_url && (
            <a href={s.welcome.whatsapp_share_url} target="_blank" rel="noreferrer noopener">
              <MButton variant="outline">
                <MessageCircle /> Send the WhatsApp welcome
              </MButton>
            </a>
          )}
          {canEmailInvoice && result.invoice && (
            <MButton
              variant="outline"
              disabled={emailState === "sending" || emailState === "sent"}
              onClick={async () => {
                setEmailState("sending");
                try {
                  await financeService.emailInvoice(result.invoice!.id, "primary");
                  setEmailState("sent");
                } catch (e) {
                  setEmailState(ispErrorMessage(e));
                }
              }}
            >
              {emailState === "sending" && <Spinner />}
              {emailState === "sent" ? "Invoice emailed" : "Email the invoice"}
            </MButton>
          )}
          <MButton variant="ghost" onClick={onAnother}>
            Add another subscriber
          </MButton>
        </div>
        {emailState !== "idle" && emailState !== "sending" && emailState !== "sent" && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            The invoice email failed: {emailState}
          </p>
        )}
      </Card>

      {plan.length > 0 && (
        <Card
          title="Documents"
          actions={
            pending ? (
              <MTag label={`Uploading ${plan.length - pending} of ${plan.length}`} tone="pending" />
            ) : failed ? (
              <MTag label={`${failed} failed`} tone="failed" />
            ) : (
              <MTag label="All uploaded" tone="active" />
            )
          }
        >
          {failed > 0 && !pending && (
            <p role="alert" className="mb-2 text-xs text-destructive">
              The subscriber was created, but {failed} file{failed === 1 ? "" : "s"} did not upload.
              Retry below, or add them later from the subscriber&apos;s KYC.
            </p>
          )}
          <ul className="space-y-1.5 text-xs">
            {plan.map((d) => {
              const u = uploads.find((x) => x.key === d.key)!;
              return (
                <li key={d.key} className="flex items-center gap-2">
                  {u.state === "done" ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : u.state === "failed" ? (
                    <CircleAlert className="size-3.5 shrink-0 text-destructive" />
                  ) : u.state === "uploading" ? (
                    <Spinner />
                  ) : (
                    <span className="inline-block size-3.5 shrink-0" />
                  )}
                  <span className="w-32 shrink-0 text-muted-foreground">
                    {KIND_LABEL[d.kind] ?? d.kind}
                  </span>
                  <span className="min-w-0 truncate">{d.file.name}</span>
                  {u.state === "failed" && (
                    <>
                      <span className="text-destructive">{u.error}</span>
                      <MButton variant="ghost" className="ml-auto" onClick={() => upload(d)}>
                        <RotateCw /> Retry
                      </MButton>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
