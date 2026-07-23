import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LifeBuoy, Clock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStat, MSeg, MTag, MTable, MTh, MTd, MTr, MDrawer, MButton, MField, M_INPUT } from "@/components/master/MasterKit";
import { organizationService } from "@/services/organization.service";
import { ticketService } from "@/services/ticket.service";
import { TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, type SupportTicket, type TicketStatus } from "@/types/support-ticket";

export const Route = createFileRoute("/master/tickets")({
  component: TicketsScreen,
});

type Filter = "all" | TicketStatus;

function TicketsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [orgNames, setOrgNames] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [saving, setSaving] = useState(false);
  const [resolution, setResolution] = useState("");

  async function refetch() {
    setLoading(true);
    try {
      const [rows, { rows: orgs }] = await Promise.all([
        ticketService.listAllOrgs(),
        organizationService.list({ page: 1, pageSize: 200 }),
      ]);
      setTickets(rows);
      setOrgNames(new Map(orgs.map((o) => [o.id, o.name])));
    } catch {
      toast.error("Could not load support tickets from the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const rows = useMemo(
    () => tickets.filter((t) => (filter === "all" ? true : t.status === filter)),
    [tickets, filter],
  );

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
  const urgentOpen = tickets.filter((t) => t.status === "open" && t.priority === "urgent").length;

  useEffect(() => {
    if (selected) setResolution(selected.resolutionNotes ?? "");
  }, [selected]);

  async function updateStatus(t: SupportTicket, status: TicketStatus) {
    setSaving(true);
    try {
      const updated = await ticketService.update(t.id, {
        status,
        resolutionNotes: status === "resolved" || status === "closed" ? resolution || undefined : undefined,
      });
      toast.success(`Ticket marked ${TICKET_STATUS_LABEL[status].toLowerCase()}`);
      setSelected(updated);
      setTickets((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    } catch {
      toast.error("Could not update the ticket.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MasterShell title="Support Tickets">
      <MSectionHeader eyebrow="Support" title="Support Tickets" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MStat label="Open" value={String(openCount)} delta={urgentOpen ? `${urgentOpen} urgent` : undefined} icon={LifeBuoy} accent={openCount > 0} />
        <MStat label="In Progress" value={String(inProgressCount)} delta="awaiting reply" icon={Clock} />
        <MStat label="Resolved" value={String(resolvedCount)} icon={CheckCircle2} />
        <MStat label="Urgent open" value={String(urgentOpen)} icon={AlertTriangle} accent={urgentOpen > 0} />
      </div>

      <MSeg
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In Progress" },
          { value: "resolved", label: "Resolved" },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
        </div>
      ) : (
        <MTable head={<><MTh>Ticket</MTh><MTh>Customer</MTh><MTh>Priority</MTh><MTh className="hidden sm:table-cell">Assignee</MTh><MTh>Status</MTh><MTh className="hidden md:table-cell">Updated</MTh></>}>
          {rows.map((t) => (
            <MTr key={t.id} onClick={() => setSelected(t)}>
              <MTd>
                <p className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 8)}</p>
                <p className="font-semibold">{t.subject}</p>
              </MTd>
              <MTd className="text-sm">{orgNames.get(t.organizationId) ?? "—"}</MTd>
              <MTd><MTag label={TICKET_PRIORITY_LABEL[t.priority]} tone={t.priority === "urgent" || t.priority === "high" ? "high" : "normal"} /></MTd>
              <MTd className="hidden text-sm sm:table-cell">{t.assignedToName ?? "Unassigned"}</MTd>
              <MTd><MTag label={TICKET_STATUS_LABEL[t.status]} tone={t.status === "open" ? "open" : t.status === "resolved" || t.status === "closed" ? "resolved" : "pending"} /></MTd>
              <MTd className="hidden text-xs text-muted-foreground md:table-cell">{new Date(t.updatedAt).toLocaleString()}</MTd>
            </MTr>
          ))}
          {rows.length === 0 && (
            <MTr><MTd className="py-10 text-center text-muted-foreground"><span className="block">No tickets match this filter.</span></MTd></MTr>
          )}
        </MTable>
      )}
      <p className="text-xs text-muted-foreground">Tickets raised from any customer's dashboard appear here in real time.</p>

      <MDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.subject ?? ""}
        subtitle={selected ? `${orgNames.get(selected.organizationId) ?? "—"} · raised by ${selected.createdByName}` : ""}
        footer={
          selected && (
            <div className="grid grid-cols-2 gap-2">
              {selected.status !== "in_progress" && (
                <MButton variant="outline" disabled={saving} onClick={() => updateStatus(selected, "in_progress")}>Mark In Progress</MButton>
              )}
              {selected.status !== "resolved" && (
                <MButton variant="primary" disabled={saving} onClick={() => updateStatus(selected, "resolved")}>Mark Resolved</MButton>
              )}
              {selected.status !== "closed" && (
                <MButton variant="outline" disabled={saving} onClick={() => updateStatus(selected, "closed")}>Close</MButton>
              )}
              {selected.status !== "open" && (
                <MButton variant="outline" disabled={saving} onClick={() => updateStatus(selected, "open")}>Reopen</MButton>
              )}
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Priority</p><div className="mt-1.5"><MTag label={TICKET_PRIORITY_LABEL[selected.priority]} /></div></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Status</p><div className="mt-1.5"><MTag label={TICKET_STATUS_LABEL[selected.status]} /></div></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Category</p><p className="mt-1 text-sm font-semibold capitalize">{selected.category?.replace("_", " ") ?? "—"}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="text-xs font-medium text-muted-foreground">Raised</p><p className="mt-1 text-sm font-semibold">{new Date(selected.createdAt).toLocaleDateString()}</p></div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Description</p>
              <p className="text-sm">{selected.description}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Raised by</p>
              <p className="text-sm">{selected.createdByName} · {selected.createdByEmail}</p>
            </div>
            <MField label="Resolution notes">
              <textarea
                className={`${M_INPUT} min-h-20`}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="What was done to resolve this?"
              />
            </MField>
          </div>
        )}
      </MDrawer>
    </MasterShell>
  );
}
