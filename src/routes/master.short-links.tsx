import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, Link2, Ban, CheckCircle, MousePointerClick, Loader2 } from "lucide-react";
import { MasterShell, useOperatorCaps } from "@/components/master/MasterShell";
import {
  MSectionHeader,
  MSeg,
  MTag,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
  MButton,
} from "@/components/master/MasterKit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { masterShortLinkService } from "@/services/master-short-link.service";
import type { MasterShortLink } from "@/types/short-link";

export const Route = createFileRoute("/master/short-links")({
  component: MasterShortLinkScreen,
});

type StatusFilter = "all" | "active" | "inactive";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const inputCls =
  "w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary";

/**
 * Master-only cross-org short link visibility + moderation --
 * `GET /master/short-links` (search/filter across every org) and
 * `PATCH /master/short-links/{id}` (force-deactivate an abusive link
 * regardless of which org owns it), per the fixed backend contract this
 * was built against. A genuinely separate screen from the customer-facing
 * `ShortLinksPage` (src/components/features/ShortLinksPage.tsx) -- built
 * against `masterShortLinkService` (its own file, never imported by
 * anything under src/components/customer/ or src/components/features/) so
 * the cross-tenant fields this table shows (organization, source) can't
 * leak into the customer dashboard bundle. Same MasterKit primitives +
 * client-side filter-after-fetch pattern as master.customers.tsx /
 * master.routers.tsx, for consistency with the rest of this console.
 */
function MasterShortLinkScreen() {
  const caps = useOperatorCaps();
  const canModerate = caps.has("short-links.moderate");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MasterShortLink[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<MasterShortLink | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<MasterShortLink | null>(null);

  async function refetch() {
    setLoading(true);
    try {
      const { rows } = await masterShortLinkService.list({ page: 1, pageSize: 200 });
      setRows(rows);
    } catch {
      toast.error("Could not load short links from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const orgOptions = useMemo(
    () => Array.from(new Map(rows.map((r) => [r.organizationId, r.organizationName])).entries()),
    [rows],
  );
  const sourceOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.source).filter((s): s is string => !!s))),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => (status === "all" ? true : status === "active" ? r.isActive : !r.isActive))
        .filter((r) => orgFilter === "all" || r.organizationId === orgFilter)
        .filter((r) => sourceFilter === "all" || r.source === sourceFilter)
        .filter(
          (r) =>
            !q ||
            `${r.code} ${r.shortUrl} ${r.targetUrl} ${r.organizationName}`
              .toLowerCase()
              .includes(q.toLowerCase()),
        ),
    [rows, status, orgFilter, sourceFilter, q],
  );

  async function confirmSetActive(link: MasterShortLink, isActive: boolean) {
    setBusyId(link.id);
    try {
      await masterShortLinkService.setActive(link.id, isActive);
      toast.success(isActive ? `"${link.code}" reactivated` : `"${link.code}" deactivated`);
      setSel(null);
      refetch();
    } catch {
      toast.error("Could not update this link on the server.");
    } finally {
      setBusyId(null);
      setConfirmTarget(null);
    }
  }

  return (
    <MasterShell title="Short Links">
      <MSectionHeader eyebrow="Platform" title="Short Links" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MSeg
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <select
            className={`${inputCls} w-auto`}
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
          >
            <option value="all">All organizations</option>
            {orgOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          {sourceOptions.length > 0 && (
            <select
              className={`${inputCls} w-auto`}
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, URL, customer…"
            className="w-60 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading short links…
        </div>
      ) : (
        <MTable
          head={
            <>
              <MTh>Link</MTh>
              <MTh className="hidden sm:table-cell">Customer</MTh>
              <MTh className="hidden md:table-cell">Source</MTh>
              <MTh>Clicks</MTh>
              <MTh>Expires</MTh>
              <MTh>Status</MTh>
            </>
          }
        >
          {filtered.map((r) => (
            <MTr key={r.id} onClick={() => setSel(r)}>
              <MTd>
                <p className="font-semibold font-mono text-xs">{r.shortUrl}</p>
                <p className="max-w-xs truncate text-xs text-muted-foreground" title={r.targetUrl}>
                  {r.targetUrl}
                </p>
              </MTd>
              <MTd className="hidden text-sm sm:table-cell">{r.organizationName}</MTd>
              <MTd className="hidden text-xs text-muted-foreground md:table-cell">
                {r.source ?? "—"}
              </MTd>
              <MTd className="text-sm tabular-nums">{r.clickCount}</MTd>
              <MTd className="text-xs text-muted-foreground">{formatDate(r.expiresAt)}</MTd>
              <MTd>
                <MTag label={r.isActive ? "active" : "suspended"} />
              </MTd>
            </MTr>
          ))}
        </MTable>
      )}
      {!loading && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No short links created on the platform yet."
            : "No short links match your filter."}
        </p>
      )}

      <MDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.code ?? ""}
        subtitle={sel ? `${sel.organizationName} · created ${formatDate(sel.createdAt)}` : ""}
        footer={
          sel &&
          canModerate && (
            <MButton
              variant="primary"
              className="w-full justify-center"
              disabled={busyId === sel.id}
              onClick={() => setConfirmTarget(sel)}
            >
              {sel.isActive ? <Ban /> : <CheckCircle />}
              {sel.isActive ? "Deactivate link" : "Reactivate link"}
            </MButton>
          )
        }
      >
        {sel && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border p-2.5 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">Clicks</p>
                <p className="mt-1 flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
                  <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                  {sel.clickCount}
                </p>
              </div>
              <div className="rounded-lg border border-border p-2.5 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                <div className="mt-1.5">
                  <MTag label={sel.isActive ? "active" : "suspended"} />
                </div>
              </div>
              <div className="rounded-lg border border-border p-2.5 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">Expires</p>
                <p className="mt-1 text-sm font-semibold">{formatDate(sel.expiresAt)}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Short URL</span>
                <span className="font-mono text-xs">{sel.shortUrl}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-muted-foreground">Destination</span>
                <span className="truncate text-xs" title={sel.targetUrl}>
                  {sel.targetUrl}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Organization</span>
                <span>{sel.organizationName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{sel.source ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last clicked</span>
                <span>{formatDate(sel.lastClickedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(sel.createdAt)}</span>
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" /> Moderation only -- destination/expiry edits happen
              in the customer's own dashboard.
            </p>
          </div>
        )}
      </MDrawer>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && busyId === null && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.isActive ? "Deactivate" : "Reactivate"} "{confirmTarget?.code}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.isActive
                ? `This immediately stops ${confirmTarget?.shortUrl} from redirecting -- visitors will see a dead link until it's reactivated. ${confirmTarget?.organizationName} keeps the link and can request reactivation.`
                : `This re-enables ${confirmTarget?.shortUrl} -- it will resume redirecting to its destination.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmTarget) confirmSetActive(confirmTarget, !confirmTarget.isActive);
              }}
              disabled={busyId !== null}
              className={
                confirmTarget?.isActive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {busyId !== null ? "Working…" : confirmTarget?.isActive ? "Deactivate" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MasterShell>
  );
}
