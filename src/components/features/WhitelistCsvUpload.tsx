import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv-export";
import { DEFAULT_DIAL_CODE, PHONE_COUNTRIES } from "@/lib/phone-e164";
import {
  WHITELIST_CSV_COLUMNS,
  WHITELIST_CSV_MAX_ROWS,
  WHITELIST_CSV_TEMPLATE,
  previewWhitelistCsv,
} from "@/lib/whitelist-csv";
import type { CsvPreview, PreviewRow } from "@/lib/whitelist-csv";
import { guestService } from "@/services/guest.service";

export interface WhitelistCsvUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolved from the session -- the tenant the upload is written to. */
  organizationId: string | null;
  locations: { id: string; name: string }[];
  defaultLocationId?: string;
  /** Identifiers already live on the list, keyed by location (`null` = org-wide). */
  existing: { identifier: string; locationId: string | null; active: boolean }[];
  demo: boolean;
  /** Called after rows were written, so the screen re-reads its list. */
  onImported: () => void;
}

interface UploadResult {
  added: number;
  alreadyListed: number;
  invalid: { line: number; raw: string; reason: string }[];
  error?: string;
}

const MAX_REASON_ROWS = 50;

/**
 * "Upload CSV" for Whitelisting: pick a file, see what will happen to every
 * row, then confirm. Nothing is sent until the owner presses "Add N guests".
 *
 * All the rules live in `lib/whitelist-csv.ts` (tested in
 * scripts/test-whitelist-csv.mjs); this component only reads the file, shows
 * the preview and posts the ready rows through
 * `guestService.importWhitelistRules`.
 */
export function WhitelistCsvUpload({
  open,
  onOpenChange,
  organizationId,
  locations,
  defaultLocationId,
  existing,
  demo,
  onImported,
}: WhitelistCsvUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [locationId, setLocationId] = useState<string>(
    defaultLocationId && locations.some((l) => l.id === defaultLocationId)
      ? defaultLocationId
      : (locations[0]?.id ?? ""),
  );
  // Locations usually arrive after this (always-mounted) dialog does.
  useEffect(() => {
    if (locationId || locations.length === 0) return;
    setLocationId(
      defaultLocationId && locations.some((l) => l.id === defaultLocationId)
        ? defaultLocationId
        : locations[0].id,
    );
  }, [locationId, locations, defaultLocationId]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  // A guest is already covered at this property by a live rule written for
  // it or written org-wide (the backend's matcher ORs `location_id IS NULL`).
  // An expired rule is not "already listed" -- uploading it again is how it
  // comes back to life (the backend refreshes the row's expiry).
  const existingHere = useMemo(
    () =>
      existing
        .filter((e) => e.active && (e.locationId === null || e.locationId === locationId))
        .map((e) => e.identifier),
    [existing, locationId],
  );

  const preview: CsvPreview | null = useMemo(
    () => (text === null ? null : previewWhitelistCsv(text, { dialCode, existing: existingHere })),
    [text, dialCode, existingHere],
  );

  const reset = () => {
    setFileName(null);
    setText(null);
    setTooBig(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = (next: boolean) => {
    if (uploading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const onFile = async (file: File | undefined) => {
    setResult(null);
    setTooBig(false);
    if (!file) return;
    setFileName(file.name);
    // 5,000 rows of phone/email/name/date is well under a megabyte; a much
    // larger file is the wrong file, not a big list.
    if (file.size > 2 * 1024 * 1024) {
      setText(null);
      setTooBig(true);
      return;
    }
    setText(await file.text());
  };

  const upload = async () => {
    if (!preview || preview.ready.length === 0) return;
    const skipped = preview.counts.duplicates + preview.counts.alreadyListed;
    const clientInvalid = preview.rows
      .filter((r) => r.status === "invalid")
      .map((r) => ({ line: r.line, raw: r.raw, reason: r.reason ?? "Invalid row." }));
    if (demo) {
      setResult({ added: preview.ready.length, alreadyListed: skipped, invalid: clientInvalid });
      onImported();
      return;
    }
    if (!organizationId || !locationId) {
      setResult({
        added: 0,
        alreadyListed: 0,
        invalid: [],
        error: "No property selected for this session.",
      });
      return;
    }
    setUploading(true);
    try {
      const ready: PreviewRow[] = preview.ready;
      const res = await guestService.importWhitelistRules({
        organizationId,
        locationId,
        rows: ready.map((r) => ({
          identifier: r.identifier!,
          email: r.email,
          reason: r.name,
          expiresAt: r.expiresAt,
        })),
      });
      const serverInvalid = res.rejected.map((r) => {
        const src = ready[r.row - 1];
        return { line: src?.line ?? r.row, raw: src?.raw ?? r.identifier, reason: r.reason };
      });
      setResult({
        added: res.imported,
        // The backend upserts a repeat rather than duplicating it; a row
        // that was already there (e.g. expired, or added since the preview)
        // lands in `updated`.
        alreadyListed: skipped + res.updated,
        invalid: [...clientInvalid, ...serverInvalid].sort((a, b) => a.line - b.line),
        error: res.error
          ? `${res.error} ${res.sentRows.toLocaleString()} of ${ready.length.toLocaleString()} rows were sent before it stopped.`
          : undefined,
      });
      if (res.imported > 0 || res.updated > 0) onImported();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload a CSV of allowed guests</DialogTitle>
          <DialogDescription>
            Adds up to {WHITELIST_CSV_MAX_ROWS.toLocaleString()} guests at once to the list for one
            property. Nothing is added until you confirm.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3" data-testid="whitelist-csv-result">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Added" value={result.added} tone="good" />
              <Stat label="Already on the list" value={result.alreadyListed} />
              <Stat label="Invalid" value={result.invalid.length} tone="bad" />
            </div>
            {result.error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {result.error}
              </p>
            )}
            <ReasonList rows={result.invalid} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                Columns:{" "}
                <span className="font-mono text-foreground">
                  {WHITELIST_CSV_COLUMNS.join(", ")}
                </span>
                . A row needs a phone or an email; name and valid_until are optional.
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                <li>
                  Phone: with a country code (+91…), or a local number that gets the country code
                  picked below.
                </li>
                <li>Email: used as the sign-in only on rows with no phone.</li>
                <li>
                  valid_until: <span className="font-mono">YYYY-MM-DD HH:MM</span> in your own time
                  zone. Leave empty for no end date.
                </li>
              </ul>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-xs"
                onClick={() => downloadCsv("whitelist-template.csv", WHITELIST_CSV_TEMPLATE)}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Download template
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Property</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger aria-label="Property">
                    <SelectValue placeholder="Choose a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Country code for local numbers</Label>
                <Select value={dialCode} onValueChange={setDialCode}>
                  <SelectTrigger aria-label="Country code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                data-testid="whitelist-csv-input"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp className="mr-2 h-4 w-4" />
                {fileName ? `Change file (${fileName})` : "Choose CSV file"}
              </Button>
            </div>

            {tooBig && (
              <p className="text-sm text-destructive">
                That file is larger than 2 MB — it is not a guest list this screen can read.
              </p>
            )}
            {preview?.fileError && <p className="text-sm text-destructive">{preview.fileError}</p>}

            {preview && !preview.fileError && preview.rows.length > 0 && (
              <div className="space-y-3" data-testid="whitelist-csv-preview">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Will be added" value={preview.counts.ready} tone="good" />
                  <Stat
                    label="Already on the list / repeated"
                    value={preview.counts.alreadyListed + preview.counts.duplicates}
                  />
                  <Stat label="Invalid" value={preview.counts.invalid} tone="bad" />
                </div>
                <ReasonList
                  rows={preview.rows
                    .filter((r) => r.status === "invalid")
                    .map((r) => ({ line: r.line, raw: r.raw, reason: r.reason ?? "" }))}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={reset}>
                Upload another
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button
                onClick={() => void upload()}
                disabled={uploading || !preview || preview.counts.ready === 0 || !locationId}
                data-testid="whitelist-csv-confirm"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {preview && preview.counts.ready > 0
                  ? `Add ${preview.counts.ready.toLocaleString()} guest${preview.counts.ready === 1 ? "" : "s"}`
                  : "Add guests"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border bg-card p-2">
      <p
        className={cn(
          "text-lg font-bold",
          tone === "good" && value > 0 && "text-emerald-600",
          tone === "bad" && value > 0 && "text-destructive",
        )}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ReasonList({ rows }: { rows: { line: number; raw: string; reason: string }[] }) {
  if (rows.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> No invalid rows.
      </p>
    );
  }
  return (
    <div className="rounded-lg border">
      <p className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Rows that will not be added
      </p>
      <ul className="max-h-48 divide-y overflow-y-auto text-xs">
        {rows.slice(0, MAX_REASON_ROWS).map((r) => (
          <li key={`${r.line}-${r.raw}`} className="flex gap-3 px-3 py-1.5">
            <span className="w-14 shrink-0 text-muted-foreground">Row {r.line}</span>
            <span className="w-40 shrink-0 truncate font-mono">{r.raw || "—"}</span>
            <span className="min-w-0 text-muted-foreground">{r.reason}</span>
          </li>
        ))}
      </ul>
      {rows.length > MAX_REASON_ROWS && (
        <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          …and {(rows.length - MAX_REASON_ROWS).toLocaleString()} more.
        </p>
      )}
    </div>
  );
}
