import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InvoicesPage, type InvoiceFilters } from "@/components/isp-partner/invoices/InvoicesPage";

interface InvoiceSearch {
  from?: string;
  to?: string;
  status?: string;
  bill?: string;
  zone?: string;
  pkg?: string;
  q?: string;
  page?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[0-9a-fA-F-]{36}$/;
const STATUSES = ["issued", "partially_paid", "paid", "cancelled"];

/** `/partner/invoices` (ADDENDUM_03). Filters live in the URL. */
export const Route = createFileRoute("/partner/invoices/")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): InvoiceSearch => {
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const out: InvoiceSearch = {};
    if (DAY.test(str(s.from))) out.from = str(s.from);
    if (DAY.test(str(s.to))) out.to = str(s.to);
    if (STATUSES.includes(str(s.status))) out.status = str(s.status);
    if (str(s.bill) === "subscriber" || str(s.bill) === "customer") out.bill = str(s.bill);
    if (ID.test(str(s.zone))) out.zone = str(s.zone);
    if (ID.test(str(s.pkg))) out.pkg = str(s.pkg);
    if (str(s.q)) out.q = str(s.q).slice(0, 100);
    const page = Number(s.page);
    if (Number.isInteger(page) && page > 1) out.page = page;
    return out;
  },
  component: InvoicesRoute,
});

function InvoicesRoute() {
  const s = Route.useSearch();
  const navigate = useNavigate();
  const filters: InvoiceFilters = {
    from: s.from ?? "",
    to: s.to ?? "",
    status: s.status ?? "",
    billTo: (s.bill as InvoiceFilters["billTo"]) ?? "",
    zone: s.zone ?? "",
    pkg: s.pkg ?? "",
    q: s.q ?? "",
    page: s.page ?? 1,
  };
  return (
    <InvoicesPage
      filters={filters}
      onFilters={(f) => {
        const next: InvoiceSearch = {};
        if (f.from) next.from = f.from;
        if (f.to) next.to = f.to;
        if (f.status) next.status = f.status;
        if (f.billTo) next.bill = f.billTo;
        if (f.zone) next.zone = f.zone;
        if (f.pkg) next.pkg = f.pkg;
        if (f.q) next.q = f.q;
        if (f.page > 1) next.page = f.page;
        navigate({ to: "/partner/invoices", search: next, replace: true });
      }}
    />
  );
}
