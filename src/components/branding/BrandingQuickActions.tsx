import { useRef } from "react";
import { toast } from "sonner";
import { Copy, Download, Rocket, RotateCcw, Save, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDuplicateBrand, useExportTheme, useImportTheme, usePublishBrand, useResetBrand, useSaveBrand } from "@/hooks/useBranding";
import type { Brand } from "@/types/branding";

export function BrandingQuickActions({ brand }: { brand: Brand }) {
  const save = useSaveBrand();
  const publish = usePublishBrand();
  const reset = useResetBrand();
  const duplicate = useDuplicateBrand();
  const exportTheme = useExportTheme();
  const importTheme = useImportTheme();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleExport = () => {
    exportTheme.mutate(brand.id, {
      onSuccess: (res) => {
        if (!res) return;
        const blob = new Blob([res.payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Theme exported");
      },
    });
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    importTheme.mutate({ id: brand.id, payload: text }, {
      onSuccess: (ok) => ok ? toast.success("Theme imported") : toast.error("Invalid theme file"),
    });
  };

  const actions = [
    { label: "Save branding", icon: Save, tone: "text-primary bg-primary/10", onClick: () => save.mutate(brand, { onSuccess: () => toast.success("Branding saved") }) },
    { label: "Publish", icon: Rocket, tone: "text-emerald-500 bg-emerald-500/10", onClick: () => publish.mutate(brand.id, { onSuccess: () => toast.success("Brand published live") }) },
    { label: "Reset theme", icon: RotateCcw, tone: "text-amber-500 bg-amber-500/10", onClick: () => reset.mutate(brand.id, { onSuccess: () => toast.success("Theme reset") }) },
    { label: "Duplicate theme", icon: Copy, tone: "text-sky-500 bg-sky-500/10", onClick: () => duplicate.mutate(brand.id, { onSuccess: () => toast.success("Brand duplicated") }) },
    { label: "Export theme", icon: Download, tone: "text-violet-500 bg-violet-500/10", onClick: handleExport },
    { label: "Import theme", icon: Upload, tone: "text-pink-500 bg-pink-500/10", onClick: () => fileRef.current?.click() },
  ];

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} variant="outline" className="h-auto justify-start gap-3 py-3" onClick={a.onClick}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-left text-xs font-medium leading-tight">{a.label}</span>
              </Button>
            );
          })}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
      </CardContent>
    </Card>
  );
}
