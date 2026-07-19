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
import { Switch } from "@/components/ui/switch";
import type { Portal, PortalBranding } from "@/types/portal";

interface Props {
  portal: Portal;
  onChange: (patch: Partial<Portal>) => void;
}

const FONTS = ["Inter", "SF Pro Text", "Playfair Display", "Roboto", "Poppins", "IBM Plex Sans", "DM Sans", "Space Grotesk"];

export function PortalCustomization({ portal, onChange }: Props) {
  const b = portal.branding;
  const set = (patch: Partial<PortalBranding>) => onChange({ branding: { ...b, ...patch } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Colors & typography</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ColorRow label="Primary color" value={b.primaryColor} onChange={(v) => set({ primaryColor: v })} />
          <ColorRow label="Secondary color" value={b.secondaryColor} onChange={(v) => set({ secondaryColor: v })} />
          <div className="space-y-2">
            <Label>Font family</Label>
            <Select value={b.fontFamily} onValueChange={(v) => set({ fontFamily: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Border radius: {b.borderRadius}px</Label>
            <input type="range" min={0} max={32} value={b.borderRadius} onChange={(e) => set({ borderRadius: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Background</CardTitle></CardHeader>
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
              <ColorRow label="Gradient from" value={b.gradientFrom} onChange={(v) => set({ gradientFrom: v })} />
              <ColorRow label="Gradient to" value={b.gradientTo} onChange={(v) => set({ gradientTo: v })} />
            </div>
          )}
          {b.backgroundType === "color" && (
            <ColorRow label="Background color" value={b.gradientFrom} onChange={(v) => set({ gradientFrom: v })} />
          )}
          {(b.backgroundType === "image" || b.backgroundType === "video") && (
            <div className="space-y-2">
              <Label>Media URL</Label>
              <Input value={b.backgroundUrl ?? ""} onChange={(e) => set({ backgroundUrl: e.target.value })} placeholder="https://…" />
            </div>
          )}
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input value={b.logoUrl ?? ""} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Styles</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <SegRow label="Button style" value={b.buttonStyle} options={["solid", "outline", "ghost"]} onChange={(v) => set({ buttonStyle: v as PortalBranding["buttonStyle"] })} />
          <SegRow label="Card style" value={b.cardStyle} options={["flat", "elevated", "glass"]} onChange={(v) => set({ cardStyle: v as PortalBranding["cardStyle"] })} />
          <SegRow label="Shadow" value={b.shadow} options={["none", "sm", "md", "lg"]} onChange={(v) => set({ shadow: v as PortalBranding["shadow"] })} />
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Animations</div>
              <div className="text-xs text-muted-foreground">Enable subtle entrance transitions</div>
            </div>
            <Switch checked={b.animations} onCheckedChange={(v) => set({ animations: v })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="color" className="h-10 w-14 cursor-pointer p-1" value={value} onChange={(e) => onChange(e.target.value)} />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function SegRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
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
