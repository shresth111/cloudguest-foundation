/** Pure helpers for the one-page "Add subscriber" (ONBOARD-1). No React,
 * no API: `scripts/test-isp-partner-onboard.mjs` runs them.
 *
 * The form is one flat string record; `buildOnboarding` turns it into the
 * `POST /isp/onboarding` body or names the section to fix. Validators mirror
 * the backend (gst.gstin_valid, compliance_logic.mask_id_number, the JAZE-2
 * MAC rule); the API stays the authority. */
import { draftToProfile } from "@/lib/isp-partner/subscribers360";
import { credentialBody, isIp } from "@/lib/isp-partner/pppoe";
import type { OnboardingBody, PendingDocument } from "@/services/isp-partner/onboarding-types";

// --- GSTIN (checksum only; live portal verification is out of scope) --------

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Same as `gst.gstin_valid`: the official shape and the mod-36 check. */
export function gstinValid(gstin: string): boolean {
  const v = gstin.trim().toUpperCase();
  if (!GSTIN_RE.test(v)) return false;
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARS.indexOf(v[i]) * (i % 2 ? 2 : 1);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (total % 36)) % 36] === v[14];
}

/** The GST state code is the GSTIN's first two digits. */
export function stateCodeFromGstin(gstin: string): string | null {
  const v = gstin.trim();
  return /^\d{2}/.test(v) ? v.slice(0, 2) : null;
}

// --- Aadhaar: validated here, only the last four digits are sent ------------

const VD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffOk(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) c = VD[c][VP[i % 8][Number(rev[i])]];
  return c === 0;
}

/** What leaves the browser for an ID number. Aadhaar: the full 12 digits
 * are checked here and only the last four are sent (the backend accepts a
 * 4-digit Aadhaar and stores only that). Other types go as typed. */
export function idNumberForApi(
  idType: string,
  raw: string,
): { value: string | null } | { error: string } {
  const v = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!v) return { value: null };
  if (idType === "aadhaar") {
    if (/^\d{4}$/.test(v)) return { value: v };
    if (!/^[2-9]\d{11}$/.test(v) || !verhoeffOk(v))
      return { error: "That is not a valid Aadhaar number." };
    return { value: v.slice(-4) };
  }
  if (idType === "pan" && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v))
    return { error: "PAN looks like ABCDE1234F." };
  if (v.length > 40 || !/^[A-Z0-9/]+$/.test(v))
    return { error: "ID number: letters, digits and / only." };
  return { value: v };
}

// --- MAC (JAZE-2 MacRequest) -----------------------------------------------

export function normMac(v: string): string | null {
  const hex = v.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 12 || v.replace(/[0-9a-fA-F:.\-\s]/g, "") !== "") return null;
  return hex.match(/.{2}/g)!.join(":");
}

// --- the form ------------------------------------------------------------------

export interface StaticIpRow {
  isp_location_id: string;
  pool_id: string;
  /** Blank = next free in the pool. */
  ip: string;
  mac: string;
  static_queue: boolean;
}

export interface OnboardForm {
  // plan + identity
  isp_customer_id: string;
  package_id: string;
  identifier: string;
  zone_id: string;
  user_type: string;
  connection_type: string;
  activation_at: string;
  // contact
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  alt_email: string;
  gstin: string;
  state_code: string;
  address: string;
  billing_city: string;
  billing_pincode: string;
  // installation
  install_same_as_billing: boolean;
  install_building: string;
  install_address: string;
  install_area: string;
  install_city: string;
  install_pincode: string;
  latitude: string;
  longitude: string;
  installed_at: string;
  ont_serial: string;
  // billing rules
  override_price: string;
  billing_anchor_day: string;
  after_due_action: string;
  exclude_reminders: boolean;
  comments: string;
  // PPPoE
  pppoe_on: boolean;
  pppoe_username: string;
  pppoe_password_mode: "generate" | "set";
  pppoe_password: string;
  // static IP / MAC
  static_ips: StaticIpRow[];
  macs: string;
  // KYC / CAF
  kyc_on: boolean;
  applicant_type: string;
  kyc_full_name: string;
  father_or_spouse_name: string;
  date_of_birth: string;
  id_proof_type: string;
  id_number: string;
  address_proof_same_as_id: boolean;
  address_proof_type: string;
  caf_mode: "auto" | "number" | "none";
  caf_number: string;
  // first invoice
  issue_invoice: boolean;
  paid_now: boolean;
  payment_mode: string;
  payment_reference: string;
  // welcome
  welcome_whatsapp: boolean;
}

export function emptyOnboardForm(): OnboardForm {
  return {
    isp_customer_id: "",
    package_id: "",
    identifier: "",
    zone_id: "",
    user_type: "home",
    connection_type: "",
    activation_at: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    alt_email: "",
    gstin: "",
    state_code: "",
    address: "",
    billing_city: "",
    billing_pincode: "",
    install_same_as_billing: true,
    install_building: "",
    install_address: "",
    install_area: "",
    install_city: "",
    install_pincode: "",
    latitude: "",
    longitude: "",
    installed_at: "",
    ont_serial: "",
    override_price: "",
    billing_anchor_day: "",
    after_due_action: "suspend",
    exclude_reminders: false,
    comments: "",
    pppoe_on: false,
    pppoe_username: "",
    pppoe_password_mode: "generate",
    pppoe_password: "",
    static_ips: [],
    macs: "",
    kyc_on: false,
    applicant_type: "individual",
    kyc_full_name: "",
    father_or_spouse_name: "",
    date_of_birth: "",
    id_proof_type: "",
    id_number: "",
    address_proof_same_as_id: true,
    address_proof_type: "",
    caf_mode: "auto",
    caf_number: "",
    issue_invoice: true,
    paid_now: false,
    payment_mode: "cash",
    payment_reference: "",
    welcome_whatsapp: true,
  };
}

export type FormSection =
  | "plan"
  | "contact"
  | "installation"
  | "billing_rules"
  | "pppoe"
  | "network"
  | "kyc"
  | "invoice";

export interface BuildContext {
  features: { pppoe: boolean; static_ip: boolean; kyc: boolean };
  /** Permissions the caller holds (the API re-checks). */
  can: { kyc: boolean; invoice: boolean; pay: boolean };
}

type Built = { body: OnboardingBody } | { error: string; section: FormSection };

const nz = (v: string) => (v.trim() ? v.trim() : null);

/** Form -> `POST /isp/onboarding` body, or the first problem and where. */
export function buildOnboarding(f: OnboardForm, ctx: BuildContext): Built {
  const fail = (section: FormSection, error: string): Built => ({ error, section });
  // plan
  if (!f.isp_customer_id) return fail("plan", "Pick the customer (venue).");
  if (!f.package_id) return fail("plan", "Pick a package.");
  const identifier = f.identifier.trim();
  if (identifier.length < 3) return fail("plan", "Login id: at least 3 characters.");
  // contact
  const gstin = f.gstin.trim().toUpperCase();
  if (gstin && !gstinValid(gstin))
    return fail("contact", "That GSTIN fails its checksum. Check it against the certificate.");
  const state = f.state_code.trim() || (gstin ? (stateCodeFromGstin(gstin) ?? "") : "");
  if (state && !/^\d{2}$/.test(state))
    return fail("contact", "State code is the 2-digit GST state code, e.g. 07.");
  if (gstin && state && gstin.slice(0, 2) !== state)
    return fail("contact", "The state code does not match the GSTIN's first two digits.");
  const email = nz(f.email);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return fail("contact", "The email looks wrong.");

  // profile (JAZE-1 draftToProfile; STB is out of scope and never sent)
  const profileDraft: Record<string, string | boolean> = {
    alt_email: f.alt_email,
    gender: "",
    billing_city: f.billing_city,
    billing_pincode: f.billing_pincode,
    install_same_as_billing: f.install_same_as_billing,
    install_address: f.install_address,
    install_area: f.install_area,
    install_building: f.install_building,
    install_city: f.install_city,
    install_pincode: f.install_pincode,
    latitude: f.latitude,
    longitude: f.longitude,
    installed_at: f.installed_at,
    user_type: f.user_type,
    connection_type: f.connection_type,
    ont_serial: f.ont_serial,
    stb_serial: "",
    override_price: f.override_price,
    billing_anchor_day: f.billing_anchor_day,
    after_due_action: f.after_due_action,
    exclude_reminders: f.exclude_reminders,
    activation_at: f.activation_at,
    comments: f.comments,
  };
  const prof = draftToProfile(profileDraft);
  if ("error" in prof) {
    const e = prof.error;
    const section: FormSection = /price|billing day/i.test(e)
      ? "billing_rules"
      : /install|latitude|longitude/i.test(e)
        ? "installation"
        : "contact";
    return fail(section, e);
  }
  const profile = { ...prof.body };
  delete (profile as Record<string, unknown>).gender;
  delete (profile as Record<string, unknown>).stb_serial;

  const body: OnboardingBody = {
    subscriber: {
      isp_customer_id: f.isp_customer_id,
      package_id: f.package_id,
      identifier,
      first_name: nz(f.first_name),
      last_name: nz(f.last_name),
      phone: nz(f.phone),
      email,
      gstin: gstin || null,
      address: nz(f.address),
      state_code: state || null,
      zone_id: f.zone_id || null,
      profile: profile as OnboardingBody["subscriber"]["profile"],
      welcome_whatsapp: f.welcome_whatsapp,
    },
  };

  // PPPoE (JAZE-6): username defaults to the login id on the server
  if (ctx.features.pppoe && f.pppoe_on) {
    const r = credentialBody(
      {
        username: f.pppoe_username,
        passwordMode: f.pppoe_password_mode,
        password: f.pppoe_password,
        static_ip: "",
        ip_pool_name: "",
      },
      null,
    );
    if ("error" in r) return fail("pppoe", r.error);
    body.pppoe = r.body;
  }

  // static IPs + MAC binds (JAZE-2)
  if (ctx.features.static_ip) {
    const ips = [];
    for (const [i, row] of f.static_ips.entries()) {
      if (!row.isp_location_id || !row.pool_id)
        return fail("network", `Static IP ${i + 1}: pick the venue and the pool.`);
      if (row.ip.trim() && !isIp(row.ip.trim()))
        return fail("network", `Static IP ${i + 1}: not an IP address.`);
      const mac = row.mac.trim() ? normMac(row.mac) : null;
      if (row.mac.trim() && !mac) return fail("network", `Static IP ${i + 1}: not a MAC address.`);
      ips.push({
        isp_location_id: row.isp_location_id,
        pool_id: row.pool_id,
        ip: row.ip.trim() || null,
        mac,
        static_queue: row.static_queue,
      });
    }
    const typed = new Set(ips.map((x) => x.ip).filter(Boolean));
    if (typed.size !== ips.filter((x) => x.ip).length)
      return fail("network", "The same static IP is listed twice.");
    if (ips.length) body.static_ips = ips;
    const macs: string[] = [];
    for (const raw of f.macs
      .split(/[,\n]+/)
      .map((x) => x.trim())
      .filter(Boolean)) {
      const m = normMac(raw);
      if (!m) return fail("network", `"${raw}" is not a MAC address.`);
      if (!macs.includes(m)) macs.push(m);
    }
    if (macs.length > 8) return fail("network", "Bind at most 8 MAC addresses here.");
    if (macs.length) body.macs = macs;
  }

  // KYC / CAF (JAZE-3)
  if (ctx.features.kyc && ctx.can.kyc && f.kyc_on) {
    const kyc: NonNullable<OnboardingBody["kyc"]> = {
      applicant_type: f.applicant_type as "individual" | "organization",
      full_name: nz(f.kyc_full_name),
      father_or_spouse_name: nz(f.father_or_spouse_name),
      date_of_birth: nz(f.date_of_birth),
      address_proof_same_as_id: f.address_proof_same_as_id,
      address_proof_type: f.address_proof_same_as_id ? null : nz(f.address_proof_type),
    };
    if (f.id_proof_type) {
      kyc.id_proof_type = f.id_proof_type;
      const id = idNumberForApi(f.id_proof_type, f.id_number);
      if ("error" in id) return fail("kyc", id.error);
      if (id.value) kyc.id_number = id.value;
    } else if (f.id_number.trim()) {
      return fail("kyc", "Pick the ID proof type for that number.");
    }
    if (!f.address_proof_same_as_id && !f.address_proof_type)
      return fail("kyc", "Pick the address proof type, or tick 'same as ID'.");
    body.kyc = kyc;
    if (f.caf_mode === "auto") body.caf = { mode: "auto" };
    else if (f.caf_mode === "number") {
      const n = f.caf_number.trim();
      if (!n || n.length > 40) return fail("kyc", "CAF number: 1 to 40 characters.");
      body.caf = { mode: "number", number: n };
    }
  }

  // first invoice
  if (ctx.can.invoice && f.issue_invoice) {
    const paid = ctx.can.pay && f.paid_now;
    if (paid && f.payment_mode !== "cash" && !f.payment_reference.trim())
      return fail("invoice", "UPI and bank transfers need the UTR / transaction reference.");
    body.billing = {
      issue_invoice: true,
      paid_now: paid,
      payment: paid ? { mode: f.payment_mode, reference: nz(f.payment_reference) } : null,
    };
  }
  return { body };
}

/** Step-2 uploads, in a stable order: proofs first, then photo, signature,
 * signed CAF, installation report. Photo and signature keep one file each
 * (the API supersedes older ones anyway). */
export function uploadPlan(docs: PendingDocument[]): PendingDocument[] {
  const order = ["id_proof", "address_proof", "photo", "signature", "caf_signed", "install_report"];
  const single = new Set(["photo", "signature"]);
  const seen = new Set<string>();
  const out: PendingDocument[] = [];
  for (const d of [...docs].reverse()) {
    if (single.has(d.kind)) {
      if (seen.has(d.kind)) continue;
      seen.add(d.kind);
    }
    out.push(d);
  }
  return out.reverse().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function documentProblem(file: { size: number; type: string }): string | null {
  if (!DOCUMENT_TYPES.includes(file.type)) return "Use a JPEG, PNG, WebP or PDF file.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Files must be 5 MB or smaller.";
  return null;
}

/** "Expires around": activation (or now) + the package's validity days. */
export function expiryPreview(
  activationLocal: string,
  validityDays: number | null | undefined,
  now: number = Date.now(),
): Date | null {
  if (!validityDays) return null;
  const start = activationLocal ? new Date(activationLocal).getTime() : now;
  if (Number.isNaN(start)) return null;
  return new Date(Math.max(start, now) + validityDays * 86_400_000);
}

export const STEP_LABEL: Record<string, string> = {
  subscriber: "Subscriber and profile",
  pppoe: "PPPoE login",
  static_ip: "Static IP",
  mac: "MAC binding",
  kyc: "KYC",
  caf: "CAF number",
  invoice: "First invoice",
  payment: "Payment",
};

export function stepLabel(step: unknown): string {
  return typeof step === "string" ? (STEP_LABEL[step] ?? step) : "Saving";
}
