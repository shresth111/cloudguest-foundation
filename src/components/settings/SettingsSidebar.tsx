import { motion } from "framer-motion";
import {
  Bell, Cloud, Cpu, Database, FileKey, FileText, Flag, Globe2, HardDrive,
  Info, KeyRound, Lock, Palette, Plug, ScrollText, ShieldCheck, Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SettingsSectionId } from "@/types/settings";

export interface SettingsNavItem {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  group: "Workspace" | "Security" | "Communications" | "Platform" | "Info";
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "general",       label: "General",       description: "Identity & locale",           icon: Globe2,       group: "Workspace" },
  { id: "branding",      label: "Branding",      description: "Logo, name & theme colors",   icon: Palette,      group: "Workspace" },
  { id: "authentication",label: "Authentication",description: "Sign-in methods & sessions",  icon: KeyRound,     group: "Security" },
  { id: "security",      label: "Security",      description: "Access controls & audit",     icon: ShieldCheck,  group: "Security" },
  { id: "notifications", label: "Notifications", description: "Channels and endpoints",      icon: Bell,         group: "Communications" },
  { id: "email",         label: "Email",         description: "Outbound email gateway",      icon: FileText,     group: "Communications" },
  { id: "sms",           label: "SMS",           description: "SMS provider & templates",    icon: ScrollText,   group: "Communications" },
  { id: "storage",       label: "Storage",       description: "Object storage & quotas",     icon: HardDrive,    group: "Platform" },
  { id: "integrations",  label: "Integrations",  description: "Third-party connectors",      icon: Plug,         group: "Platform" },
  { id: "payment",       label: "Payment",       description: "Billing gateway",             icon: Wallet,       group: "Platform" },
  { id: "api",           label: "API",           description: "Keys, webhooks & limits",     icon: FileKey,      group: "Platform" },
  { id: "system",        label: "System",        description: "Runtime & maintenance",       icon: Cpu,          group: "Platform" },
  { id: "backup",        label: "Backup",        description: "Snapshots & restore",         icon: Database,     group: "Platform" },
  { id: "feature_flags", label: "Feature flags", description: "Toggle major modules",        icon: Flag,         group: "Platform" },
  { id: "license",       label: "License",       description: "Plan & entitlements",         icon: Lock,         group: "Info" },
  { id: "about",         label: "About",         description: "Versions & build info",       icon: Info,         group: "Info" },
];

const GROUPS: SettingsNavItem["group"][] = ["Workspace", "Security", "Communications", "Platform", "Info"];

interface SettingsSidebarProps {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
  items?: SettingsNavItem[];
}

export function SettingsSidebar({ active, onSelect, items = SETTINGS_NAV }: SettingsSidebarProps) {
  return (
    <nav aria-label="Platform settings navigation" className="space-y-6">
      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (!groupItems.length) return null;
        return (
          <div key={group}>
            <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
            <ul className="space-y-1">
              {groupItems.map((item) => {
                const Icon = item.icon;
                const selected = item.id === active;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "relative flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        selected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {selected && (
                        <motion.span
                          layoutId="settings-active-pill"
                          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "text-primary" : "")} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{item.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground/80">{item.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Cloud_() { return <Cloud className="h-4 w-4" />; }
