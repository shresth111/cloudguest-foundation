import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "./SectionHeader";

interface ComingSoonPanelProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  bullets?: string[];
  primaryAction?: { label: string; onClick?: () => void };
  eyebrow?: string;
}

/**
 * Production-safe placeholder for routes whose data layer is being staged.
 * Renders a real page header, capability preview and a permission-aware CTA
 * so the shell never shows a blank screen — used exclusively when the API
 * contract is defined but not yet wired.
 */
export function ComingSoonPanel({
  title,
  description,
  icon: Icon = Sparkles,
  bullets = [],
  primaryAction,
  eyebrow = "Rolling out",
}: ComingSoonPanelProps) {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />

      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-background to-muted/30">
        <CardContent className="grid gap-8 p-8 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">Preview of what's coming</h3>
            <p className="text-sm text-muted-foreground">
              Data contracts and permission scopes are already wired. UI reveals as regional rollouts complete —
              your role automatically unlocks controls when the module ships in your tenant.
            </p>
            {primaryAction && (
              <Button variant="default" onClick={primaryAction.onClick}>
                {primaryAction.label}
              </Button>
            )}
          </div>
          {bullets.length > 0 && (
            <ul className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-5">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary/70" />
                  <span className="text-foreground/90">{b}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
