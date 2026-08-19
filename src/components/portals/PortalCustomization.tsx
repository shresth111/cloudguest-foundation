import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { GUEST_FONT_CHOICES, type GuestFontChoice } from "@/types/portal-runtime";
import {
  GUEST_FONT_CHOICE_DESCRIPTION,
  GUEST_FONT_CHOICE_LABEL,
  GUEST_FONT_FACES,
} from "@/lib/portal-guest-fonts";
import type { Portal, PortalBranding } from "@/types/portal";

interface Props {
  portal: Portal;
  onChange: (patch: Partial<Portal>) => void;
}

// captive-portal-v6-design-spec.md §1.3/§3.5: this used to be an 8-option
// free-text `<Select>` (Inter, SF Pro Text, Playfair Display, Roboto,
// Poppins, IBM Plex Sans, DM Sans, Space Grotesk) bound to
// `PortalBranding.fontFamily` -- which `portal.service.ts#update()`'s own
// serialization whitelist never included, so every one of those choices
// was silently discarded on save (confirmed directly, §1.3). Replaced with
// the real, backend-round-tripped, curated 4-value enum
// (`RuntimePortalConfig.guestFontChoice` / `PortalBranding.fontChoice`) --
// see `src/lib/portal-guest-fonts.ts` for the actual self-hosted asset
// each non-"system" option loads, and this file's `update()` call for the
// whitelist fix that makes this real end-to-end.
let guestFontPreviewStyleInjected = false;

/** Injects the same self-hosted curated `@font-face` rules the guest
 * runtime uses (PortalRuntimeContext.tsx) so this admin picker's live text
 * previews render in the actual face -- cheap (the same ≤18KB files,
 * already fetched once this panel is open) and never touches the guest-
 * facing pre-auth surface this spec's "no webfont cost" rule is actually
 * about (§0.3/§3.3): this is the authenticated Portals builder, not
 * `/portal/*`. Injected once per app session (module-level guard), not
 * once per mount -- this panel can remount (tab switches) without ever
 * needing a second copy. */
function useGuestFontPreviewFaces() {
  useEffect(() => {
    if (guestFontPreviewStyleInjected) return;
    guestFontPreviewStyleInjected = true;
    const style = document.createElement("style");
    style.setAttribute("data-guest-font-preview", "1");
    style.textContent = Object.values(GUEST_FONT_FACES)
      .map(
        (face) => `
        @font-face {
          font-family: "${face.fontFamily}";
          src: url("${face.woff2Path}") format("woff2");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
      `,
      )
      .join("\n");
    document.head.appendChild(style);
  }, []);
}

export function PortalCustomization({ portal, onChange }: Props) {
  const b = portal.branding;
  const set = (patch: Partial<PortalBranding>) => onChange({ branding: { ...b, ...patch } });
  useGuestFontPreviewFaces();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Colors & typography</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColorRow
            label="Primary color"
            value={b.primaryColor}
            onChange={(v) => set({ primaryColor: v })}
          />
          <ColorRow
            label="Secondary color"
            value={b.secondaryColor}
            onChange={(v) => set({ secondaryColor: v })}
          />
          <div className="space-y-2 sm:col-span-2">
            <Label>Heading font</Label>
            <Select
              value={b.fontChoice}
              onValueChange={(v) => set({ fontChoice: v as GuestFontChoice })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GUEST_FONT_CHOICES.map((choice) => (
                  <SelectItem key={choice} value={choice}>
                    <span
                      style={
                        choice === "system"
                          ? undefined
                          : { fontFamily: GUEST_FONT_FACES[choice].fontFamily, fontWeight: 700 }
                      }
                    >
                      {GUEST_FONT_CHOICE_LABEL[choice]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {GUEST_FONT_CHOICE_DESCRIPTION[b.fontChoice]} Applies to headings only. Hindi and
              Arabic headings always use the system font for full character support.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Border radius: {b.borderRadius}px</Label>
            <input
              type="range"
              min={0}
              max={32}
              value={b.borderRadius}
              onChange={(e) => set({ borderRadius: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Background</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {(["gradient", "color", "image", "video"] as const).map((t) => (
              <button
                key={t}
                onClick={() => set({ backgroundType: t })}
                className={`rounded-md border px-2 py-2 text-xs capitalize ${b.backgroundType === t ? "border-primary bg-primary/10" : "hover:bg-muted/60"}`}
              >
                {t}
              </button>
            ))}
          </div>
          {b.backgroundType === "gradient" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorRow
                label="Gradient from"
                value={b.gradientFrom}
                onChange={(v) => set({ gradientFrom: v })}
              />
              <ColorRow
                label="Gradient to"
                value={b.gradientTo}
                onChange={(v) => set({ gradientTo: v })}
              />
            </div>
          )}
          {b.backgroundType === "color" && (
            <ColorRow
              label="Background color"
              value={b.gradientFrom}
              onChange={(v) => set({ gradientFrom: v })}
            />
          )}
          {(b.backgroundType === "image" || b.backgroundType === "video") && (
            <div className="space-y-2">
              <Label>Media URL</Label>
              <Input
                value={b.backgroundUrl ?? ""}
                onChange={(e) => set({ backgroundUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input
              value={b.logoUrl ?? ""}
              onChange={(e) => set({ logoUrl: e.target.value })}
              placeholder="https://…"
            />
            <p className="text-xs text-muted-foreground">
              Displays at 24×24px on the portal. Use a square PNG, 256×256px, transparent
              background, for a sharp result on retina screens.
            </p>
          </div>
          <OverlayStrengthRow
            value={b.backgroundOverlayStrength}
            hasBackgroundImage={!!b.backgroundUrl}
            onCommit={(v) => set({ backgroundOverlayStrength: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Styles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <SegRow
            label="Button style"
            value={b.buttonStyle}
            options={["solid", "outline", "ghost"]}
            onChange={(v) => set({ buttonStyle: v as PortalBranding["buttonStyle"] })}
          />
          <SegRow
            label="Card style"
            value={b.cardStyle}
            options={["flat", "elevated", "glass"]}
            onChange={(v) => set({ cardStyle: v as PortalBranding["cardStyle"] })}
          />
          <SegRow
            label="Shadow"
            value={b.shadow}
            options={["none", "sm", "md", "lg"]}
            onChange={(v) => set({ shadow: v as PortalBranding["shadow"] })}
          />
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Animations</div>
              <div className="text-xs text-muted-foreground">
                Enable subtle entrance transitions
              </div>
            </div>
            <Switch checked={b.animations} onCheckedChange={(v) => set({ animations: v })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * captive-portal-v6-design-spec.md §4.4 -- the real per-venue overlay-
 * strength slider, replacing the previously-hardcoded scrim opacity
 * (`buildGuestBackdropScrim`, PortalShell.tsx) with a genuine 0-100 admin
 * input. `onValueChange` (fires continuously while dragging) only updates
 * this component's own local display value -- the actual `onCommit`
 * (patch/mutate, a real network PUT) fires once on `onValueCommit` (drag
 * release / arrow-key step), the same "live value while dragging, persist
 * once settled" shape every other live-previewed control on this surface
 * would use, rather than firing a PUT per pixel of drag.
 *
 * Disabled with an explanatory caption when no background image is set --
 * `PortalNoPhotoPattern`'s flat-canvas treatment (PortalShell.tsx) has no
 * scrim to tune, and this codebase already has a standing principle
 * (PortalShell.tsx's own comments) against rendering a dead control.
 */
function OverlayStrengthRow({
  value,
  hasBackgroundImage,
  onCommit,
}: {
  value: number;
  hasBackgroundImage: boolean;
  onCommit: (v: number) => void;
}) {
  const [display, setDisplay] = useState(value);
  useEffect(() => setDisplay(value), [value]);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>Background overlay strength</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{display}</span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[display]}
        disabled={!hasBackgroundImage}
        onValueChange={([v]) => setDisplay(v)}
        onValueCommit={([v]) => onCommit(v)}
      />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Lighter — for a plain or dark photo</span>
        <span>Stronger — for a busy or bright photo</span>
      </div>
      {!hasBackgroundImage && (
        <p className="text-xs text-muted-foreground">
          Set a background image above to enable this control -- there's no photo scrim to tune
          without one.
        </p>
      )}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          className="h-10 w-14 cursor-pointer p-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function SegRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="inline-flex rounded-md border p-0.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded px-2.5 py-1 text-xs capitalize ${value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
