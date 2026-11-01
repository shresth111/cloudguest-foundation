/** P3-SWEEP: edit an inventory item or a stock location (APPS-2 PATCH
 * routes). Pure helpers so the request body can be tested without a DOM:
 * only the fields that changed are sent, strings are trimmed, an emptied
 * optional field is sent as null, and a required field is never emptied. */

export interface ItemDraft {
  name: string;
  sku: string;
  category: string;
  notes: string;
}

export interface ItemBefore {
  name: string;
  sku: string;
  category: string;
  notes: string | null;
}

export interface LocationDraft {
  name: string;
  kind: string;
  holder: string;
  address: string;
  active: boolean;
}

export interface LocationBefore {
  name: string;
  kind: string;
  holder_user_id: string | null;
  address: string | null;
  active: boolean;
}

export type Patch = Record<string, string | boolean | null>;
export type Checked = { body: Patch } | { error: string };

export const itemDraft = (i: ItemBefore): ItemDraft => ({
  name: i.name,
  sku: i.sku,
  category: i.category,
  notes: i.notes ?? "",
});

export const locationDraft = (l: LocationBefore): LocationDraft => ({
  name: l.name,
  kind: l.kind,
  holder: l.holder_user_id ?? "",
  address: l.address ?? "",
  active: l.active,
});

const opt = (v: string): string | null => v.trim() || null;

export function itemPatch(before: ItemBefore, d: ItemDraft): Checked {
  const name = d.name.trim();
  const sku = d.sku.trim();
  if (!name) return { error: "Type the item name." };
  if (!sku) return { error: "Type the SKU." };
  const body: Patch = {};
  if (name !== before.name) body.name = name;
  if (sku !== before.sku) body.sku = sku;
  if (d.category !== before.category) body.category = d.category;
  if (opt(d.notes) !== (before.notes ?? null)) body.notes = opt(d.notes);
  return { body };
}

export function locationPatch(before: LocationBefore, d: LocationDraft): Checked {
  const name = d.name.trim();
  if (!name) return { error: "Type the location name." };
  if (d.kind === "technician_bag" && !d.holder)
    return { error: "Pick the technician who carries the bag." };
  const body: Patch = {};
  if (name !== before.name) body.name = name;
  if (d.kind !== before.kind) body.kind = d.kind;
  const holder = d.holder || null;
  if (holder !== (before.holder_user_id ?? null)) body.holder_user_id = holder;
  if (opt(d.address) !== (before.address ?? null)) body.address = opt(d.address);
  if (d.active !== before.active) body.active = d.active;
  return { body };
}

export const nothingChanged = (c: Checked): boolean =>
  "body" in c && Object.keys(c.body).length === 0;
