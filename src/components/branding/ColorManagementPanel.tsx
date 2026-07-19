import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetBrand, useSaveBrand } from "@/hooks/useBranding";
import type { Brand, BrandColors } from "@/types/branding";

const FIELDS: { key: keyof BrandColors; label: string; group: string }[] = [
  { key: "primary", label: "Primary", group: "Brand" },
  { key: "secondary", label: "Secondary", group: "Brand" },
  { key: "accent", label: "Accent", group: "Brand" },
  { key: "success", label: "Success", group: "Status" },
  { key: "warning", label: "Warning", group: "Status" },
  { key: "error", label: "Error", group: "Status" },
  { key: "sidebar", label: "Sidebar", group: "Surfaces" },
  { key: "navbar", label: "Navbar", group: "Surfaces" },
  { key: "buttonBg", label: "Button background", group: "Components" },
  { key: "buttonText", label: "Button text", group: "Components" },
  { key: "cardBg", label: "Card background", group: "Components" },
  { key: "cardBorder", label: "Card border", group: "Components" },
];

export function ColorManagementPanel({ brand }: { brand: Brand }) {
  const save = useSaveBrand();
  const reset = useResetBrand();

  const setColor = (key: keyof BrandColors, value: string) => {
    save.mutate({ ...brand, colors: { ...brand.colors, [key]: value } });
  };

  const groups = FIELDS.reduce<Record<string, typeof FIELDS>>((acc, f) => {
    (acc[f.group] ||= []).push(f);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Color palette</CardTitle>
        <Button variant="outline" size="sm" onClick={() => reset.mutate(brand.id, { onSuccess: () => toast.success("Theme reset") })}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Reset theme
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{group}</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((f) => (
                <div key={f.key} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md border" style={{ background: brand.colors[f.key] }}>
                    <input
                      type="color"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      value={brand.colors[f.key]}
                      onChange={(e) => setColor(f.key, e.target.value)}
                    />
                  </label>
                  <div className="flex-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      className="mt-1 h-7 font-mono text-xs"
                      value={brand.colors[f.key]}
                      onChange={(e) => setColor(f.key, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
