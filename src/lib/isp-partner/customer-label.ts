/**
 * QA-018: two customers of one ISP may share a name (the slug gets a random
 * suffix), and every picker then showed the same label twice. A name that is
 * unique stays as it is; a duplicated one gets a second field -- the ISP's
 * own account number, else the city, else the contact e-mail, else the slug.
 */
export interface CustomerLabelInput {
  id: string;
  name: string;
  external_ref?: string | null;
  city?: string | null;
  contact_email?: string | null;
  slug?: string | null;
}

export function customerLabels(customers: readonly CustomerLabelInput[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const c of customers) {
    const key = c.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const c of customers) {
    const dup = (counts.get(c.name.trim().toLowerCase()) ?? 0) > 1;
    const second = c.external_ref || c.city || c.contact_email || c.slug || c.id.slice(0, 8);
    out.set(c.id, dup ? `${c.name} · ${second}` : c.name);
  }
  return out;
}
