import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApplyTemplate, useDuplicateBrand } from "@/hooks/useBranding";
import type { Brand, BrandingTemplate } from "@/types/branding";

export function BrandingTemplatesGallery({ brand, templates }: { brand: Brand; templates: BrandingTemplate[] }) {
  const apply = useApplyTemplate();
  const duplicate = useDuplicateBrand();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Branding templates</CardTitle>
        <p className="text-xs text-muted-foreground">Kick-start a brand with a curated palette and typography preset.</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <div className="group overflow-hidden rounded-xl border transition hover:shadow-lg">
                <div className="relative h-24" style={{ background: `linear-gradient(135deg, ${t.colors.primary}, ${t.colors.accent})` }}>
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    {[t.colors.primary, t.colors.secondary, t.colors.accent].map((c) => (
                      <span key={c} className="h-4 w-4 rounded-full border border-white/40" style={{ background: c }} />
                    ))}
                  </div>
                  <Badge className="absolute right-2 top-2 capitalize" variant="secondary">{t.category}</Badge>
                </div>
                <div className="space-y-2 p-3">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.typography.fontFamily}</div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => apply.mutate({ brandId: brand.id, templateId: t.id }, { onSuccess: () => toast.success(`Applied ${t.name}`) })}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => duplicate.mutate(brand.id, { onSuccess: () => toast.success("Duplicated current brand") })}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
