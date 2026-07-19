import {
  LayoutDashboard, Building2, MapPin, Router, Users, UserSquare2,
  LayoutTemplate, ShieldCheck, Activity, BarChart3, LifeBuoy, Settings,
  Receipt, Palette, ScrollText, Store, KeyRound, Plug, HeartPulse, Bell,
  Download, ClipboardList, ToggleRight, Circle, Wifi, Ticket, ShieldAlert,
  Signal, Cable, Cpu, Radio, Globe, Filter, Fingerprint, Megaphone,
  QrCode, MessageSquare, type LucideIcon,
} from "lucide-react";

/** Resolve backend icon names (PascalCase from lucide-react) to components. */
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Building2, MapPin, Router, Users, UserSquare2,
  LayoutTemplate, ShieldCheck, Activity, BarChart3, LifeBuoy, Settings,
  Receipt, Palette, ScrollText, Store, KeyRound, Plug, HeartPulse, Bell,
  Download, ClipboardList, ToggleRight, Circle, Wifi, Ticket, ShieldAlert,
  Signal, Cable, Cpu, Radio, Globe, Filter, Fingerprint, Megaphone,
  QrCode, MessageSquare,
};

export function resolveIcon(name?: string): LucideIcon {
  if (!name) return Circle;
  return ICONS[name] ?? Circle;
}
