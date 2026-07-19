import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useSaveBrand } from "@/hooks/useBranding";
import type { Brand, Typography } from "@/types/branding";

const FONTS = ["Inter", "SF Pro Display", "Space Grotesk", "Manrope", "Playfair Display", "Merriweather", "Roboto", "IBM Plex Sans"];
const SHADOWS: Typography["shadow"][] = ["none", "sm", "md", "lg", "xl"];

export function TypographyPanel({ brand }: { brand: Brand }) {
  const save = useSaveBrand();
  const set = <K extends keyof Typography>(key: K, value: Typography[K]) => {
    save.mutate({ ...brand, typography: { ...brand.typography, [key]: value } });
  };

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Typography & shape</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Font family</Label>
          <Select value={brand.typography.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Shadow</Label>
          <Select value={brand.typography.shadow} onValueChange={(v) => set("shadow", v as Typography["shadow"])}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{SHADOWS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <RangeRow label={`Base font size (${brand.typography.fontSize}px)`} value={brand.typography.fontSize} min={12} max={20} onChange={(v) => set("fontSize", v)} />
        <RangeRow label={`Heading weight (${brand.typography.headingWeight})`} value={brand.typography.headingWeight} min={400} max={900} step={100} onChange={(v) => set("headingWeight", v)} />
        <RangeRow label={`Button weight (${brand.typography.buttonWeight})`} value={brand.typography.buttonWeight} min={400} max={900} step={100} onChange={(v) => set("buttonWeight", v)} />
        <RangeRow label={`Border radius (${brand.typography.borderRadius}px)`} value={brand.typography.borderRadius} min={0} max={32} onChange={(v) => set("borderRadius", v)} />
        <RangeRow label={`Card radius (${brand.typography.cardRadius}px)`} value={brand.typography.cardRadius} min={0} max={32} onChange={(v) => set("cardRadius", v)} />

        <div className="md:col-span-2">
          <Label>Custom font (optional)</Label>
          <Input className="mt-1" placeholder="e.g. Custom Sans, sans-serif" onBlur={(e) => e.target.value && set("fontFamily", e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}

function RangeRow({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Slider className="mt-2" value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}
