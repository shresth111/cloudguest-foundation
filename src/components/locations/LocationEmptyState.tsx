import { Inbox, MapPin, Wifi, Router as RouterIcon, Users, FileText, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

interface DomainEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo?: string;
}

function DomainEmptyState({ icon: Icon = Inbox, title, description, ctaLabel, ctaTo }: DomainEmptyStateProps) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">
        <Button onClick={() => ctaTo && navigate({ to: ctaTo })}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}

export function LocationEmptyState() {
  return <DomainEmptyState icon={MapPin} title="No locations yet" description="Add your first location to start managing guest WiFi." ctaLabel="Add location" ctaTo="/locations" />;
}

export function VlanEmptyState() {
  return <DomainEmptyState icon={Wifi} title="No VLANs configured" description="Create virtual networks to segment your guest traffic." ctaLabel="Create VLAN" ctaTo="/network/vlan" />;
}

export function DeviceEmptyState() {
  return <DomainEmptyState icon={RouterIcon} title="No devices registered" description="Register your first router to start provisioning." ctaLabel="Register router" ctaTo="/routers" />;
}

export function UserEmptyState() {
  return <DomainEmptyState icon={Users} title="No users found" description="Invite team members to collaborate on your network." ctaLabel="Invite users" ctaTo="/rbac" />;
}

export function ReportEmptyState() {
  return <DomainEmptyState icon={FileText} title="No reports generated" description="Generate your first report to gain insights." ctaLabel="Create report" ctaTo="/analytics" />;
}
