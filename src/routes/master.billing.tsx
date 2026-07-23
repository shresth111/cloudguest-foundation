import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { DollarSign, TrendingUp, Users, AlertTriangle, Check } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStat, MTag, MButton, MTable, MTh, MTd, MTr } from "@/components/master/MasterKit";
import { INVOICES } from "@/lib/masterData";

export const Route = createFileRoute("/master/billing")({
  component: BillingScreen,
});

const PLANS = [
  { name: "Starter", price: "$99", per: "/mo", features: ["1 location", "Captive portal", "Email support", "Basic analytics"], featured: false },
  { name: "Growth", price: "$299", per: "/mo", features: ["Up to 25 locations", "Vouchers & campaigns", "RaaS reporting", "Priority support"], featured: true },
  { name: "Enterprise", price: "Custom", per: "", features: ["Unlimited locations", "VLAN / VOIP / ISP routing", "Dedicated NAS cluster", "24×7 SLA + CSM"], featured: false },
];

function BillingScreen() {
  return (
    <MasterShell title="Subscriptions & Billing">
      <MSectionHeader eyebrow="Revenue" title="Subscriptions & Billing" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MStat label="MRR" value="$17.7k" delta="+8.4%" icon={DollarSign} />
        <MStat label="ARR" value="$212k" delta="projected" icon={TrendingUp} />
        <MStat label="ARPU" value="$2.2k" delta="per tenant" icon={Users} />
        <MStat label="Overdue" value="$900" delta="1 invoice" icon={AlertTriangle} accent />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={"border-2 bg-card p-5 " + (p.featured ? "border-primary" : "border-border")}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold uppercase tracking-wide">{p.name}</p>
              {p.featured && <MTag label="Popular" tone="suspended" />}
            </div>
            <p className="mt-3"><span className="text-3xl font-extrabold tracking-tight">{p.price}</span><span className="text-sm text-muted-foreground">{p.per}</span></p>
            <ul className="mt-4 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}</li>
              ))}
            </ul>
            <MButton variant={p.featured ? "primary" : "outline"} className="mt-5 w-full justify-center" onClick={() => toast.success(`${p.name} plan selected`)}>Assign Plan</MButton>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-bold uppercase tracking-wide">Recent Invoices</p>
        <MTable head={<><MTh>Invoice</MTh><MTh>Customer</MTh><MTh>Plan</MTh><MTh>Amount</MTh><MTh className="hidden sm:table-cell">Date</MTh><MTh>Status</MTh></>}>
          {INVOICES.map((inv) => (
            <MTr key={inv.id}>
              <MTd className="font-mono text-sm font-bold">{inv.id}</MTd>
              <MTd className="font-semibold">{inv.customer}</MTd>
              <MTd className="text-sm">{inv.plan}</MTd>
              <MTd className="font-semibold tabular-nums">${inv.amount}</MTd>
              <MTd className="hidden text-sm text-muted-foreground sm:table-cell">{inv.date}</MTd>
              <MTd><MTag label={inv.status} /></MTd>
            </MTr>
          ))}
        </MTable>
      </div>
    </MasterShell>
  );
}
