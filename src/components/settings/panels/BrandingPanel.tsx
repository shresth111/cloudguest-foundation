import { useState } from "react";
import { ImageIcon, Save, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionCard, FieldGrid } from "../SectionCard";
import { usePlatformBranding } from "@/context/PlatformBrandingContext";

/**
 * Super Admin platform branding -- distinct from White Label (/branding),
 * which configures *customer* org brands against a real backend. This
 * panel edits CloudGuest's own operator identity (sidebar/login/tab
 * branding), currently backed by a local static config
 * (src/config/platform-branding.config.ts), not a backend endpoint -- see
 * platform-branding.service.ts's module docstring for why. Color/name
 * edits below apply live (via PlatformBrandingProvider's CSS-variable
 * bridge) so this doubles as a real preview, but nothing here persists
 * past a refresh, and the Save button stays disabled until a real
 * `PUT /platform/branding` exists.
 */
export function BrandingPanel() {
  const { branding, previewBranding } = usePlatformBranding();
  const [companyName, setCompanyName] = useState(branding.companyName);

  return (
    <SectionCard
      title="Branding"
      description="This operator's identity across the Super Admin console -- logo, name and theme colors."
      actions={
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" disabled>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Persisting branding needs a backend endpoint that doesn't exist yet -- changes below
            preview live but reset on refresh.
          </TooltipContent>
        </Tooltip>
      }
    >
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        Coming soon — logo/favicon upload and durable save land with the platform branding API.
      </div>

      <FieldGrid>
        <Field label="Logo">
          <button
            type="button"
            disabled
            className="flex h-24 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 text-sm text-muted-foreground"
          >
            <Upload className="h-4 w-4" /> Upload placeholder
          </button>
        </Field>
        <Field label="Favicon">
          <button
            type="button"
            disabled
            className="flex h-24 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 text-sm text-muted-foreground"
          >
            <ImageIcon className="h-4 w-4" /> Upload placeholder
          </button>
        </Field>

        <Field label="Company name">
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onBlur={() => previewBranding({ companyName })}
          />
        </Field>

        <Field label="Primary color">
          <ColorField
            value={branding.primaryColor}
            onChange={(v) => previewBranding({ primaryColor: v })}
          />
        </Field>
        <Field label="Secondary color">
          <ColorField
            value={branding.secondaryColor}
            onChange={(v) => previewBranding({ secondaryColor: v })}
          />
        </Field>
        <Field label="Accent color">
          <ColorField
            value={branding.accentColor}
            onChange={(v) => previewBranding({ accentColor: v })}
          />
        </Field>
      </FieldGrid>

      <div className="flex items-center gap-2 pt-1">
        <Badge variant="outline" className="text-[10px]">Preview only</Badge>
        <span className="text-xs text-muted-foreground">
          Color/name edits above apply instantly across the console but are not saved.
        </span>
      </div>
    </SectionCard>
  );
}

/**
 * Native color input doesn't parse oklch() -- the theme's own color space
 * (src/styles.css) -- so this field edits/previews as free-form CSS color
 * text instead of a color-picker swatch. A real save flow would validate
 * and could add a swatch once it accepts hex/oklch both.
 */
function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onChange(draft)}
      spellCheck={false}
      className="font-mono text-xs"
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
