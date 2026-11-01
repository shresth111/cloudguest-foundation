/** ZONE-1 shapes. Contract: LANE_NOTES [ZONE-1] (BE `feat/isp-zone-tree`). */

export interface ZoneNode {
  id: string;
  name: string;
  parent_id: string | null;
  depth: number;
  path_ids: string[];
  path_names: string[];
  city: string | null;
  state_code: string | null;
  /** Direct children. */
  children: number;
  customers: number;
  subscribers: number;
  subtree_customers: number;
  subtree_subscribers: number;
  can_delete: boolean;
}

export interface ZoneTree {
  items: ZoneNode[];
  ledger_enabled: boolean;
}

export interface ZoneCreateBody {
  name: string;
  parent_id?: string | null;
  city?: string | null;
  state_code?: string | null;
  notes?: string | null;
}

export interface ZoneSubtree {
  zone_id: string;
  name: string;
  path_names: string[];
  zone_ids: string[];
}

export interface ZoneTotalsRow {
  zone_id: string;
  name: string;
  parent_id: string | null;
  depth: number;
  invoiced_paise: number;
  collected_paise: number;
  balance_paise: number | null;
  subtree_invoiced_paise: number;
  subtree_collected_paise: number;
  subtree_balance_paise: number | null;
  subscribers: number;
  subtree_subscribers: number;
}

export interface ZoneTotals {
  ledger_enabled: boolean;
  items: ZoneTotalsRow[];
}
