/** ONBOARD-1: one-page "Add subscriber". Mirrors the new BE file
 * `isp_partner/onboarding_router.py` (branch `feat/isp-onboard`):
 *
 * - `GET  /isp/onboarding/options` tells the form which sections exist.
 * - `POST /isp/onboarding` creates everything that needs no file in ONE
 *   database transaction (subscriber + profile, PPPoE login, static IPs,
 *   MAC binds, KYC record + CAF number, first invoice + payment). Any
 *   failure rolls all of it back and answers with `data.step` naming the
 *   section that failed.
 * - Files (ID / address proofs, photo, signature, signed CAF, installation
 *   report) are step 2, uploaded one by one to the existing JAZE-3
 *   document endpoint once the subscriber exists.
 *
 * Not `POST /isp/subscribers/onboard`: that path is JAZE-1's (create +
 * profile only) and stays as it is. */
import type { KycDocument, KycRecord } from "@/services/isp-partner/compliance";
import type { IpBinding, IpBindingBody, MacBinding } from "@/services/isp-partner/network-types";
import type { PppoeCredentialBody, PppoeCredentialSaved } from "@/services/isp-partner/pppoe-types";
import type { InvoiceRow } from "@/services/isp-partner/invoices-types";
import type { OnboardBody, Subscriber360 } from "@/services/isp-partner/subscribers360-types";

export interface OnboardingOptions {
  next_circuit_id: number;
  features: {
    /** `ISP_PPPOE_ENABLED`. */
    pppoe: boolean;
    /** Static IP + MAC bind (JAZE-2 tables; stored even while enforcement
     * is off, applied when it is on). */
    static_ip: boolean;
    /** `ISP_STATIC_QUEUE_PUSH` (default OFF): when off a static-queue
     * request is recorded on the IP, nothing is pushed to the router. */
    static_queue_push: boolean;
    /** JAZE-3 KYC / CAF. */
    kyc: boolean;
    /** JAZE-4 invoice email (`ISP_FINANCE_EXTRAS_ENABLED`). */
    invoice_email: boolean;
    /** APPS-2: Apps is on, so an install task can be created. */
    install_task?: boolean;
  };
  kyc: { id_types: string[]; document_kinds: string[] };
  payment_modes: string[];
}

export type OnboardStep =
  | "subscriber"
  | "pppoe"
  | "static_ip"
  | "mac"
  | "kyc"
  | "caf"
  | "invoice"
  | "payment"
  | "task";

export interface OnboardingBody {
  /** JAZE-1 `OnboardBody` (identity, package, contact, zone, profile,
   * welcome_whatsapp). */
  subscriber: OnboardBody;
  pppoe?: PppoeCredentialBody | null;
  static_ips?: IpBindingBody[];
  macs?: string[];
  /** JAZE-3 KYC fields; `id_number` is masked server-side (Aadhaar keeps
   * the last 4 digits only) and never echoed back. */
  kyc?: (Partial<Omit<KycRecord, "id_number">> & { id_number?: string; verified?: boolean }) | null;
  caf?: { mode: "auto" } | { mode: "number"; number: string } | null;
  /** APPS-2: an unclaimed install task, same transaction (default on). */
  create_install_task?: boolean;
  lead_id?: string;
  billing?: {
    issue_invoice: boolean;
    paid_now?: boolean;
    payment?: { mode: string; reference?: string | null } | null;
  } | null;
}

export interface OnboardingResult {
  subscriber: Subscriber360;
  pppoe: PppoeCredentialSaved | null;
  static_ips: IpBinding[];
  macs: MacBinding[];
  kyc: KycRecord | null;
  caf_number: string | null;
  invoice: InvoiceRow | null;
  payment: { id: string; receipt_number: string; amount_paise: number } | null;
  /** A static queue was asked for while the push flag is off. */
  static_queue_recorded: boolean;
  /** APPS-2: the install task created with the subscriber (null = none). */
  task?: { id: string; status: string; title: string } | null;
  steps: { step: OnboardStep; status: "done" | "skipped"; detail: string | null }[];
}

/** Step 2: one file for the JAZE-3 document endpoint. */
export interface PendingDocument {
  key: string;
  kind: string;
  file: File;
}

export type UploadState =
  | { key: string; state: "waiting" | "uploading" }
  | { key: string; state: "done"; doc: KycDocument }
  | { key: string; state: "failed"; error: string };
