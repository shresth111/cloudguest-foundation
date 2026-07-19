import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { adSchema, type AdValues } from "@/lib/portal-schemas";
import { useAddAd, useRemoveAd } from "@/hooks/usePortals";
import type { Portal } from "@/types/portal";

export function PortalQrPanel({ portal }: { portal: Portal }) {
  const [size, setSize] = useState(220);
  const url = `https://portal.cloudguest.io/${portal.id}`;
  const downloadSvg = () => {
    const svg = document.getElementById("portal-qr")?.outerHTML;
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${portal.id}-qr.svg`;
    link.click();
  };
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">QR login</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 p-4">
          <div className="rounded-lg bg-white p-4">
            <QRCodeSVG id="portal-qr" value={url} size={size} />
          </div>
          <div className="text-xs text-muted-foreground">{url}</div>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Size: {size}px</Label>
            <input type="range" min={140} max={320} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </div>
          <Button variant="outline" onClick={downloadSvg}><Download className="mr-2 h-4 w-4" />Download SVG</Button>
          <p className="text-xs text-muted-foreground">Print or share this QR code so guests can jump straight to the portal without typing a URL.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PortalAdsPanel({ portal }: { portal: Portal }) {
  const add = useAddAd(portal.id);
  const remove = useRemoveAd(portal.id);
  const { register, handleSubmit, reset, formState, watch, setValue } = useForm<AdValues>({
    resolver: zodResolver(adSchema),
    defaultValues: {
      name: "",
      type: "banner",
      mediaUrl: "",
      clickUrl: "",
      startsAt: new Date().toISOString().slice(0, 10),
      endsAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      active: true,
    },
  });
  const submit = handleSubmit(async (v) => {
    await add.mutateAsync({
      name: v.name,
      type: v.type,
      mediaUrl: v.mediaUrl,
      clickUrl: v.clickUrl,
      startsAt: new Date(v.startsAt).toISOString(),
      endsAt: new Date(v.endsAt).toISOString(),
      active: v.active,
    });
    reset();
  });
  const type = watch("type");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle className="text-sm">Advertisements</CardTitle></CardHeader>
        <CardContent>
          {portal.ads.length === 0 ? (
            <EmptyState title="No ads scheduled" description="Add banners or promotional videos to appear on the portal." />
          ) : (
            <div className="space-y-2">
              {portal.ads.map((ad) => (
                <div key={ad.id} className="flex items-center gap-3 rounded-lg border p-2">
                  {ad.type === "banner" ? (
                    <img src={ad.mediaUrl} alt={ad.name} className="h-12 w-24 rounded object-cover" />
                  ) : (
                    <div className="flex h-12 w-24 items-center justify-center rounded bg-muted text-[10px] uppercase tracking-wide text-muted-foreground">Video</div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {ad.name}
                      <Badge variant={ad.active ? "default" : "secondary"}>{ad.active ? "Active" : "Paused"}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ad.impressions.toLocaleString()} views · {ad.clicks.toLocaleString()} clicks ·
                      {" "}CTR {((ad.clicks / Math.max(1, ad.impressions)) * 100).toFixed(2)}%
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(ad.startsAt).toLocaleDateString()} → {new Date(ad.endsAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove.mutate(ad.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Schedule an ad</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input {...register("name")} placeholder="Summer promo" />
              {formState.errors.name && <p className="text-xs text-destructive">{formState.errors.name.message}</p>}</div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setValue("type", v as "banner" | "video")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Banner image</SelectItem>
                  <SelectItem value="video">Promo video</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Media URL</Label><Input {...register("mediaUrl")} placeholder="https://…/banner.jpg" />
              {formState.errors.mediaUrl && <p className="text-xs text-destructive">{formState.errors.mediaUrl.message}</p>}</div>
            <div className="space-y-1"><Label>Click URL</Label><Input {...register("clickUrl")} placeholder="https://…" />
              {formState.errors.clickUrl && <p className="text-xs text-destructive">{formState.errors.clickUrl.message}</p>}</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Starts</Label><Input type="date" {...register("startsAt")} /></div>
              <div className="space-y-1"><Label>Ends</Label><Input type="date" {...register("endsAt")} /></div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm">Active</span>
              <Switch checked={watch("active")} onCheckedChange={(v) => setValue("active", v)} />
            </div>
            <Button type="submit" size="sm" className="w-full"><Plus className="mr-2 h-4 w-4" />Add ad</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
