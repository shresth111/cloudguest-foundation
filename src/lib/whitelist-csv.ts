/**
 * "Upload CSV" for the Whitelisting list -- the pure half: parse a file,
 * turn every row into the identifier a guest signs in with, and say what
 * will happen to each row before anything is sent.
 *
 * WHERE THE WORK HAPPENS
 * ----------------------
 * The backend already has the bulk endpoint (`POST
 * /guest-access/rules/import`): it canonicalises every row with the same
 * code the single add uses, refuses bad rows individually, and upserts a
 * repeat instead of duplicating it. It takes 1,000 rows per request. This
 * module does what that endpoint cannot: read the file, catch the problems
 * a person can fix before uploading (a missing country code, an email with
 * a typo, the same guest twice), skip entries that are already on the list,
 * and split up to 5,000 rows into 1,000-row requests.
 *
 * PHONES
 * ------
 * Normalised with `normalizePhoneToE164` -- the one normaliser Blocked
 * Guests and the single add share -- against the dialling code the owner
 * picks for the file. A number that is already "+..." keeps its own code.
 *
 * WHICH COLUMN IS THE SIGN-IN
 * ---------------------------
 * The single add form stores the phone as the identifier and the email as
 * a contact note. A row here does the same when it has a phone. A row with
 * only an email is stored with the email as the identifier, so a guest who
 * signs in by email is matched.
 */
import { DEFAULT_DIAL_CODE, normalizePhoneToE164 } from "@/lib/phone-e164";

/** Most rows one upload accepts. Five batches at the backend's limit. */
export const WHITELIST_CSV_MAX_ROWS = 5000;
/** The backend's `MAX_IMPORT_BATCH_SIZE` (guest_access/constants.py). */
export const WHITELIST_IMPORT_BATCH_SIZE = 1000;

export const WHITELIST_CSV_COLUMNS = ["phone", "email", "name", "valid_until"] as const;

/** The downloadable template. Values are obviously fake. */
export const WHITELIST_CSV_TEMPLATE =
  "phone,email,name,valid_until\n" +
  "+911234500000,guest@example.com,Room 101,2030-12-31 11:00\n" +
  "1234500001,,Room 102,\n" +
  ",guest2@example.com,Conference guest,\n";

const HEADER_ALIASES: Record<(typeof WHITELIST_CSV_COLUMNS)[number], string[]> = {
  phone: ["phone", "mobile", "phone_number", "mobile_number", "number", "identifier", "contact"],
  email: ["email", "e-mail", "email_address", "mail"],
  name: ["name", "guest", "guest_name", "full_name", "reason", "note", "label", "room"],
  valid_until: [
    "valid_until",
    "expires_at",
    "expiry",
    "expires",
    "end_date",
    "end",
    "checkout",
    "check_out",
    "until",
  ],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** RFC 4180-ish: quoted fields, doubled quotes, CRLF/LF, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type ColumnMap = Partial<Record<(typeof WHITELIST_CSV_COLUMNS)[number], number>>;

function headerKey(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function mapHeader(header: string[]): ColumnMap {
  const map: ColumnMap = {};
  header.forEach((cell, idx) => {
    const key = headerKey(cell);
    for (const col of WHITELIST_CSV_COLUMNS) {
      if (map[col] === undefined && HEADER_ALIASES[col].includes(key)) {
        map[col] = idx;
        return;
      }
    }
  });
  return map;
}

export type RowStatus = "ready" | "duplicate-in-file" | "already-listed" | "invalid";

export interface PreviewRow {
  /** 1-based data row (the header is not counted, blank lines are skipped). */
  line: number;
  raw: string;
  status: RowStatus;
  /** Why it is invalid or skipped. */
  reason?: string;
  identifier?: string;
  email?: string;
  name?: string;
  /** UTC ISO instant, when the row carried one. */
  expiresAt?: string;
}

export interface CsvPreview {
  /** A problem with the whole file; `rows` is empty when set. */
  fileError?: string;
  rows: PreviewRow[];
  ready: PreviewRow[];
  counts: {
    total: number;
    ready: number;
    duplicates: number;
    alreadyListed: number;
    invalid: number;
  };
}

/** A spreadsheet's date, read in the browser's own zone like the single
 * add's datetime-local field. Accepts "YYYY-MM-DD", "YYYY-MM-DD HH:MM" and
 * full ISO strings; returns `null` for anything else. */
export function parseValidUntil(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(v);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    // A bare date means the end of that day, which is what "valid until
    // the 31st" means to a person.
    const date =
      h === undefined
        ? new Date(Number(y), Number(mo) - 1, Number(d), 23, 59, 0)
        : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
    return Number.isNaN(date.getTime()) || date.getMonth() !== Number(mo) - 1 ? null : date;
  }
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) {
    const date = new Date(v);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export interface PreviewOptions {
  dialCode?: string;
  /** Identifiers already on the list for the target property (E.164 or email). */
  existing?: Iterable<string>;
  nowMs?: number;
  maxRows?: number;
}

/** Everything the upload dialog shows before the owner confirms. */
export function previewWhitelistCsv(text: string, opts: PreviewOptions = {}): CsvPreview {
  const dialCode = opts.dialCode ?? DEFAULT_DIAL_CODE;
  const nowMs = opts.nowMs ?? Date.now();
  const maxRows = opts.maxRows ?? WHITELIST_CSV_MAX_ROWS;
  const existing = new Set([...(opts.existing ?? [])].map((s) => s.trim().toLowerCase()));
  const empty = (fileError: string): CsvPreview => ({
    fileError,
    rows: [],
    ready: [],
    counts: { total: 0, ready: 0, duplicates: 0, alreadyListed: 0, invalid: 0 },
  });

  const table = parseCsv(text);
  if (table.length === 0) return empty("The file is empty.");

  let map = mapHeader(table[0]);
  let body = table.slice(1);
  if (map.phone === undefined && map.email === undefined) {
    // No recognisable header. Accept a plain one-column list of numbers or
    // emails -- the most common thing pasted out of a spreadsheet -- but
    // refuse anything wider rather than guess which column is which.
    const first = table[0][0]?.trim() ?? "";
    const looksLikeData = EMAIL_RE.test(first) || /^[+\d(][\d\s\-().]{5,}$/.test(first);
    if (table.every((r) => r.filter((c) => c.trim() !== "").length <= 1) && looksLikeData) {
      map = { phone: 0 };
      body = table;
    } else {
      return empty(
        `Couldn't find a phone or email column. The first row should be a header: ${WHITELIST_CSV_COLUMNS.join(", ")}.`,
      );
    }
  }
  if (body.length === 0) return empty("The file has a header but no rows.");
  if (body.length > maxRows) {
    return empty(
      `This file has ${body.length.toLocaleString()} rows. Upload at most ${maxRows.toLocaleString()} at a time — split it into smaller files.`,
    );
  }

  const seen = new Set<string>();
  const rows: PreviewRow[] = body.map((cells, i) => {
    const line = i + 1;
    const cell = (idx: number | undefined) => (idx === undefined ? "" : (cells[idx] ?? "").trim());
    const phoneRaw = cell(map.phone);
    const emailRaw = cell(map.email);
    const name = cell(map.name) || undefined;
    const untilRaw = cell(map.valid_until);
    const raw = phoneRaw || emailRaw || cells.join(",");
    const invalid = (reason: string): PreviewRow => ({ line, raw, status: "invalid", reason });

    // A phone column holding an email is common in hand-made lists.
    const phoneIsEmail = phoneRaw.includes("@");
    let identifier: string;
    let email: string | undefined;
    if (phoneRaw && !phoneIsEmail) {
      if (/^\d+(\.\d+)?e\+?\d+$/i.test(phoneRaw)) {
        return invalid(
          "The spreadsheet turned this number into scientific notation. Format the phone column as text and export again.",
        );
      }
      const result = normalizePhoneToE164(phoneRaw, dialCode);
      if (!result.ok) return invalid(result.message);
      identifier = result.e164;
      if (emailRaw) {
        if (!EMAIL_RE.test(emailRaw)) return invalid(`"${emailRaw}" isn't a valid email address.`);
        email = emailRaw;
      }
    } else {
      const candidate = phoneIsEmail ? phoneRaw : emailRaw;
      if (!candidate) return invalid("No phone number or email on this row.");
      if (!EMAIL_RE.test(candidate)) return invalid(`"${candidate}" isn't a valid email address.`);
      identifier = candidate;
    }

    let expiresAt: string | undefined;
    if (untilRaw) {
      const d = parseValidUntil(untilRaw);
      if (!d) return invalid(`"${untilRaw}" isn't a date we can read. Use YYYY-MM-DD HH:MM.`);
      if (d.getTime() <= nowMs) return invalid("The valid-until date is already in the past.");
      expiresAt = d.toISOString();
    }

    const key = identifier.toLowerCase();
    const base = { line, raw, identifier, email, name, expiresAt };
    if (seen.has(key)) {
      return { ...base, status: "duplicate-in-file", reason: "Listed earlier in this file." };
    }
    seen.add(key);
    if (existing.has(key)) {
      return { ...base, status: "already-listed", reason: "Already on the list." };
    }
    return { ...base, status: "ready" };
  });

  const ready = rows.filter((r) => r.status === "ready");
  return {
    rows,
    ready,
    counts: {
      total: rows.length,
      ready: ready.length,
      duplicates: rows.filter((r) => r.status === "duplicate-in-file").length,
      alreadyListed: rows.filter((r) => r.status === "already-listed").length,
      invalid: rows.filter((r) => r.status === "invalid").length,
    },
  };
}

/** Split into request-sized batches. */
export function chunkRows<T>(rows: T[], size: number = WHITELIST_IMPORT_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
