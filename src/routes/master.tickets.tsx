import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStat, MSeg, MTag, MTable, MTh, MTd, MTr } from "@/components/master/MasterKit";
import { TICKETS } from "@/lib/masterData";

export const Route = createFileRoute("/master/tickets")({
  component: TicketsScreen,
});

type Filter = "all" | "Open" | "Pending" | "Resolved";

function TicketsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => TICKETS.filter((t) => (filter === "all" ? true : t.status === filter)), [filter]);

  return (
    <MasterShell title="Support Tickets">
      <MSectionHeader eyebrow="Support" title="Support Tickets" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MStat label="Open" value="2" delta="1 urgent" icon={LifeBuoy} accent />
        <MStat label="Pending" value="2" delta="awaiting reply" icon={Clock} />
        <MStat label="Resolved 7d" value="24" delta="+6" icon={CheckCircle2} />
        <MStat label="SLA breaches" value="1" delta="this week" icon={AlertTriangle} />
      </div>

      <MSeg
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "Open", label: "Open" },
          { value: "Pending", label: "Pending" },
          { value: "Resolved", label: "Resolved" },
        ]}
      />

      <MTable head={<><MTh>Ticket</MTh><MTh>Customer</MTh><MTh>Priority</MTh><MTh className="hidden sm:table-cell">Assignee</MTh><MTh>Status</MTh><MTh className="hidden md:table-cell">Updated</MTh></>}>
        {rows.map((t) => (
          <MTr key={t.id}>
            <MTd>
              <p className="font-mono text-xs text-muted-foreground">{t.id}</p>
              <p className="font-semibold">{t.subject}</p>
            </MTd>
            <MTd className="text-sm">{t.customer}</MTd>
            <MTd><MTag label={t.priority} /></MTd>
            <MTd className="hidden text-sm sm:table-cell">{t.assignee}</MTd>
            <MTd><MTag label={t.status} /></MTd>
            <MTd className="hidden text-xs text-muted-foreground md:table-cell">{t.updated}</MTd>
          </MTr>
        ))}
      </MTable>
      <p className="text-xs text-muted-foreground">Tickets originate from the Customer Dashboard's Help screen.</p>
    </MasterShell>
  );
}
