import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CalendarClock,
  Inbox,
  PhoneCall,
  CheckCircle2,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import {
  MPageShell,
  MSectionHeader,
  MStat,
  MSeg,
  MTag,
  MTable,
  MTh,
  MTd,
  MTr,
  MDrawer,
  MButton,
  MField,
  M_INPUT,
} from "@/components/master/MasterKit";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import type { AppError } from "@/services/api";
import { demoRequestService } from "@/services/demo-request.service";
import {
  DEMO_REQUEST_STATUS_LABEL,
  type DemoRequest,
  type DemoRequestStatus,
} from "@/types/demo-request";

export const Route = createFileRoute("/master/demo-requests")({
  component: DemoRequestsScreen,
});

type Filter = "all" | DemoRequestStatus;

const STATUS_TONE: Record<DemoRequestStatus, string> = {
  new: "pending",
  contacted: "normal",
  scheduled: "active",
  closed: "resolved",
};

function DemoRequestsScreen() {
  const { can } = useAuth();
  // Gated on the backend's own key, at the same GLOBAL scope the endpoint
  // checks -- an operator without it never sees a button that would 403.
  const canDelete = can("demo_requests.delete");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [selected, setSelected] = useState<DemoRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<DemoRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refetch() {
    setLoading(true);
    try {
      const rows = await demoRequestService.list();
      setRequests(rows);
    } catch {
      toast.error("Could not load demo requests from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  useEffect(() => {
    if (selected) setNotes(selected.internalNotes ?? "");
  }, [selected]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q)
      );
    });
  }, [requests, filter, search]);

  const newCount = requests.filter((r) => r.status === "new").length;
  const contactedCount = requests.filter((r) => r.status === "contacted").length;
  const scheduledCount = requests.filter((r) => r.status === "scheduled").length;
  const closedCount = requests.filter((r) => r.status === "closed").length;

  async function updateStatus(r: DemoRequest, status: DemoRequestStatus) {
    setSaving(true);
    try {
      const updated = await demoRequestService.update(r.id, {
        status,
        internalNotes: notes || undefined,
      });
      toast.success(`Marked ${DEMO_REQUEST_STATUS_LABEL[status].toLowerCase()}`);
      setSelected(updated);
      setRequests((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
    } catch {
      toast.error("Could not update this demo request.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await demoRequestService.update(selected.id, { internalNotes: notes });
      toast.success("Notes saved");
      setSelected(updated);
      setRequests((prev) => prev.map((x) => (x.id === selected.id ? updated : x)));
    } catch {
      toast.error("Could not save notes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: DemoRequest) {
    setDeleting(true);
    try {
      await demoRequestService.delete(r.id);
      // The list lives in local state (no query cache), so dropping the row
      // here is the invalidation; the stat tiles and filters recompute.
      setRequests((prev) => prev.filter((x) => x.id !== r.id));
      setSelected((prev) => (prev && prev.id === r.id ? null : prev));
      setConfirmDelete(null);
      toast.success(`Demo request from ${r.fullName} deleted`);
    } catch (err) {
      toast.error((err as AppError).message || "Could not delete this demo request.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <MasterShell title="Demo Requests">
      <MPageShell>
        <MSectionHeader eyebrow="Sales" title="Demo Requests" />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MStat label="New" value={String(newCount)} icon={Inbox} accent={newCount > 0} />
          <MStat label="Contacted" value={String(contactedCount)} icon={PhoneCall} />
          <MStat label="Scheduled" value={String(scheduledCount)} icon={CalendarClock} />
          <MStat label="Closed" value={String(closedCount)} icon={CheckCircle2} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <MSeg
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "new", label: "New" },
              { value: "contacted", label: "Contacted" },
              { value: "scheduled", label: "Scheduled" },
              { value: "closed", label: "Closed" },
            ]}
          />
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${M_INPUT} pl-8`}
              placeholder="Search name, email, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <MTable
          loading={loading}
          head={
            <>
              <MTh>Prospect</MTh>
              <MTh>Company</MTh>
              <MTh className="hidden sm:table-cell">Contact</MTh>
              <MTh>Status</MTh>
              <MTh className="hidden md:table-cell">Submitted</MTh>
            </>
          }
        >
          {!loading &&
            rows.map((r) => (
              <MTr key={r.id} onClick={() => setSelected(r)}>
                <MTd>
                  <p className="font-semibold">{r.fullName}</p>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </MTd>
                <MTd className="text-sm">{r.companyName}</MTd>
                <MTd className="hidden text-sm text-muted-foreground sm:table-cell">
                  {r.phone ?? "—"}
                </MTd>
                <MTd>
                  <MTag label={DEMO_REQUEST_STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
                </MTd>
                <MTd className="hidden text-xs text-muted-foreground md:table-cell">
                  {new Date(r.submittedAt).toLocaleString()}
                </MTd>
              </MTr>
            ))}
          {!loading && rows.length === 0 && (
            <MTr>
              <MTd className="py-10 text-center text-muted-foreground">
                <span className="block">No demo requests match this filter.</span>
              </MTd>
            </MTr>
          )}
        </MTable>
        <p className="text-xs text-muted-foreground">
          Every submission from the public "Book a Demo" form appears here.
        </p>

        <MDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected?.fullName ?? ""}
          subtitle={
            selected
              ? `${selected.companyName} · submitted ${new Date(selected.submittedAt).toLocaleDateString()}`
              : ""
          }
          footer={
            selected && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {selected.status !== "contacted" && (
                    <MButton
                      variant="outline"
                      disabled={saving}
                      onClick={() => updateStatus(selected, "contacted")}
                    >
                      Mark Contacted
                    </MButton>
                  )}
                  {selected.status !== "scheduled" && (
                    <MButton
                      variant="primary"
                      disabled={saving}
                      onClick={() => updateStatus(selected, "scheduled")}
                    >
                      Mark Scheduled
                    </MButton>
                  )}
                  {selected.status !== "closed" && (
                    <MButton
                      variant="outline"
                      disabled={saving}
                      onClick={() => updateStatus(selected, "closed")}
                    >
                      Close
                    </MButton>
                  )}
                  {selected.status !== "new" && (
                    <MButton
                      variant="outline"
                      disabled={saving}
                      onClick={() => updateStatus(selected, "new")}
                    >
                      Reopen
                    </MButton>
                  )}
                </div>
                {canDelete && (
                  <MButton
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    disabled={saving || deleting}
                    onClick={() => setConfirmDelete(selected)}
                  >
                    <Trash2 /> Delete Demo Request
                  </MButton>
                )}
              </div>
            )
          }
        >
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="mt-1 text-sm font-semibold">{selected.email}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Phone</p>
                  <p className="mt-1 text-sm font-semibold">{selected.phone ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Company</p>
                  <p className="mt-1 text-sm font-semibold">{selected.companyName}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="mt-1.5">
                    <MTag
                      label={DEMO_REQUEST_STATUS_LABEL[selected.status]}
                      tone={STATUS_TONE[selected.status]}
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Message</p>
                <p className="whitespace-pre-wrap text-sm">
                  {selected.message || "No message provided."}
                </p>
              </div>
              <MField label="Internal notes">
                <textarea
                  className={`${M_INPUT} min-h-24`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Follow-up notes, not visible to the prospect…"
                />
              </MField>
              <MButton variant="outline" disabled={saving} onClick={saveNotes}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save notes
              </MButton>
            </div>
          )}
        </MDrawer>

        {/* Delete confirmation */}
        <AlertDialog
          open={!!confirmDelete}
          onOpenChange={(open) => !open && !deleting && setConfirmDelete(null)}
        >
          {/* Portal + Content assembled here rather than ui/alert-dialog's
              AlertDialogContent: MDrawer is an inline `z-[60]` layer and the
              shared overlay/content are `z-50`, so the dialog would open
              behind the drawer's backdrop (see CustomerAddonsPanel). */}
          <AlertDialogPortal>
            <AlertDialogOverlay className="z-[70]" />
            <AlertDialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[70] grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete demo request from {confirmDelete?.fullName} ({confirmDelete?.companyName})?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the request from this list. Any demo already booked from it stays on
                  the calendar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirmDelete) handleDelete(confirmDelete);
                  }}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Delete Demo Request"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogPrimitive.Content>
          </AlertDialogPortal>
        </AlertDialog>
      </MPageShell>
    </MasterShell>
  );
}
