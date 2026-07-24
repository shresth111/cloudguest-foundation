import { useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const UNITS = ["Marina Bay Hotel", "Downtown CoWork", "Eastside Cafe", "Airport Lounge T3"];
const inputCls = "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

interface Asset { businessUnit: string; url: string; }

export default function BrandAssetPage({ title, description, tableTitle, tableSubtitle, aspect }: { title: string; description: string; tableTitle: string; tableSubtitle: string; aspect: "wide" | "square" }) {
  const [businessUnit, setBusinessUnit] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null);

  const upload = () => {
    if (!businessUnit) { toast.error("Select a business unit."); return; }
    if (!file) { toast.error("Choose a file to upload."); return; }
    const url = URL.createObjectURL(file);
    setAssets((a) => [{ businessUnit, url }, ...a.filter((x) => x.businessUnit !== businessUnit)]);
    setFile(null);
    toast.success(`${title} updated for ${businessUnit}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>Business Unit <span className="text-destructive">*</span></label>
            <select value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} className={inputCls}>
              <option value="">Choose business unit</option>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>File</label>
            <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40">
              <ImageUp className="h-4 w-4 shrink-0" />
              <span className="truncate">{file ? file.name : "No file chosen"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-center"><button onClick={upload} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90">Upload</button></div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <h3 className="text-base font-semibold text-foreground">{tableTitle}</h3>
        <p className="mb-4 text-xs text-muted-foreground">{tableSubtitle}</p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2.5">Business Name</th><th className="px-3 py-2.5">Preview</th><th className="px-3 py-2.5 text-right">Action</th></tr></thead>
            <tbody>
              {assets.length === 0 ? (
                <tr><td colSpan={3} className="py-10 text-center text-sm text-muted-foreground">No data available in table</td></tr>
              ) : assets.map((a) => (
                <tr key={a.businessUnit} className="border-b last:border-0 hover:bg-accent/50">
                  <td className="px-3 py-2.5 font-medium text-foreground">{a.businessUnit}</td>
                  <td className="px-3 py-2.5">
                    <img src={a.url} alt="" className={cn("rounded-md border object-cover", aspect === "wide" ? "h-10 w-20" : "h-10 w-10")} />
                  </td>
                  <td className="px-3 py-2.5 text-right"><button onClick={() => setAssets((p) => p.filter((x) => x.businessUnit !== a.businessUnit))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
