import { Settings2 } from "lucide-react";
import { ComingSoonPanel } from "@/components/ui-ext/ComingSoonPanel";

// This module used to carry four more exports -- PoliciesPage,
// WhitelistPage, TeamsPage and NetworkingPage -- each a mock over hardcoded
// rows (a fake "Plan Expiry", a toast-only "Reboot"). Nothing imported any
// of them: the real screens are PoliciesHub, WhiteList and ManageTeamsPage.
// They were deleted with the console migration (batch 3D) rather than
// restyled. AdvancedPage is the one export still routed.

// Was 6 interactive-looking toggles (API Access, MFA, Email Alerts, Auto
// Backup, Health Checks, Debug Logging) that only ever flipped local
// React state and fired a toast -- no backend endpoint exists for any of
// them, so a real customer flipping "MFA" or "API Access" here believed
// it took effect when nothing happened server-side. Honest "not wired
// yet" placeholder instead of a convincing-looking fake control panel,
// matching this codebase's own ComingSoonPanel convention (used
// elsewhere for exactly this "API contract not staged yet" situation).
export function AdvancedPage() {
  return (
    <ComingSoonPanel
      icon={Settings2}
      title="Advanced settings"
      description="Fine-grained platform controls -- API access, multi-factor auth, automated backups, and diagnostic logging -- are being wired up to real, per-organization configuration."
      bullets={[
        "REST API access toggle",
        "Multi-factor authentication requirement",
        "Automated configuration backups",
        "Verbose diagnostic logging",
      ]}
    />
  );
}
