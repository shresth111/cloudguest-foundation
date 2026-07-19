import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlignLeft,
  Contact,
  FileCode,
  Film,
  Heading1,
  Image as ImageIcon,
  KeyRound,
  LayoutTemplate,
  LogIn,
  MapPin,
  Megaphone,
  Minus,
  MonitorSmartphone,
  MousePointerClick,
  QrCode,
  Share2,
  Square,
  Trash2,
  Type,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PortalLivePreview } from "./PortalLivePreview";
import type { Portal, PortalComponent, PortalComponentType } from "@/types/portal";

const PALETTE: Array<{ type: PortalComponentType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { type: "logo", label: "Logo", icon: LayoutTemplate },
  { type: "heading", label: "Heading", icon: Heading1 },
  { type: "text", label: "Text", icon: AlignLeft },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "video", label: "Video", icon: Film },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "form", label: "Form", icon: Type },
  { type: "login_card", label: "Login Card", icon: LogIn },
  { type: "otp_input", label: "OTP Input", icon: KeyRound },
  { type: "voucher_input", label: "Voucher Input", icon: KeyRound },
  { type: "pms_login", label: "PMS Login", icon: LogIn },
  { type: "social_login", label: "Social Buttons", icon: Share2 },
  { type: "qr_code", label: "QR Code", icon: QrCode },
  { type: "ad_banner", label: "Ad Banner", icon: Megaphone },
  { type: "footer", label: "Footer", icon: Square },
  { type: "contact", label: "Contact", icon: Contact },
  { type: "map", label: "Map", icon: MapPin },
  { type: "html_block", label: "HTML Block", icon: FileCode },
];

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_PROPS: Record<PortalComponentType, Record<string, string | number | boolean>> = {
  logo: {},
  heading: { text: "Welcome to WiFi" },
  text: { text: "Sign in to enjoy complimentary internet." },
  image: { src: "https://picsum.photos/seed/hero/600/220" },
  video: {},
  button: { label: "Learn more" },
  divider: {},
  form: {},
  login_card: {},
  otp_input: {},
  voucher_input: {},
  pms_login: {},
  social_login: {},
  qr_code: {},
  ad_banner: {},
  footer: { text: "Powered by CloudGuest" },
  contact: {},
  map: {},
  html_block: {},
};

interface Props {
  portal: Portal;
  onChange: (patch: Partial<Portal>) => void;
}

export function PortalBuilder({ portal, onChange }: Props) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(portal.components[0]?.id ?? null);
  const selected = portal.components.find((c) => c.id === selectedId) ?? null;

  const addComponent = (type: PortalComponentType) => {
    const item: PortalComponent = { id: uid(), type, props: { ...DEFAULT_PROPS[type] } };
    onChange({ components: [...portal.components, item] });
    setSelectedId(item.id);
  };

  const removeComponent = (id: string) => {
    onChange({ components: portal.components.filter((c) => c.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const updateProp = (id: string, key: string, value: string | number | boolean) => {
    onChange({
      components: portal.components.map((c) =>
        c.id === id ? { ...c, props: { ...c.props, [key]: value } } : c,
      ),
    });
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...portal.components];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ components: next });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_280px]">
      {/* Palette */}
      <Card className="h-fit lg:sticky lg:top-4">
        <div className="border-b p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Components</div>
          <div className="text-[11px] text-muted-foreground">Drag or click to add</div>
        </div>
        <div className="grid max-h-[540px] grid-cols-2 gap-1 overflow-auto p-2 lg:grid-cols-1">
          {PALETTE.map((p) => (
            <button
              key={p.type}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("component-type", p.type)}
              onClick={() => addComponent(p.type)}
              className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-border hover:bg-muted/60"
            >
              <p.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Canvas */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="text-sm font-medium">Canvas</div>
          <div className="inline-flex rounded-md border p-0.5">
            {(["desktop", "tablet", "mobile"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={`rounded px-2 py-1 text-xs capitalize ${
                  device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MonitorSmartphone className="mr-1 inline h-3 w-3" /> {d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-2">
          {/* Structure list */}
          <div
            className="rounded-lg border border-dashed p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const t = e.dataTransfer.getData("component-type") as PortalComponentType;
              if (t) addComponent(t);
            }}
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Structure</div>
            <AnimatePresence initial={false}>
              {portal.components.map((c, idx) => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`group mb-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                    selectedId === c.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"
                  }`}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) move(dragIndex, idx);
                    setDragIndex(null);
                  }}
                  onClick={() => setSelectedId(c.id)}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <span className="flex-1 capitalize">{c.type.replace(/_/g, " ")}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeComponent(c.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {portal.components.length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                Drag a component here to begin
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</div>
            <PortalLivePreview portal={portal} device={device} />
          </div>
        </div>
      </Card>

      {/* Inspector */}
      <Card className="h-fit p-3 lg:sticky lg:top-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspector</div>
        {!selected ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Select a component to edit its properties.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-medium capitalize">{selected.type.replace(/_/g, " ")}</div>
            {"text" in selected.props && (
              <div className="space-y-1">
                <Label className="text-xs">Text</Label>
                <Input value={String(selected.props.text ?? "")} onChange={(e) => updateProp(selected.id, "text", e.target.value)} />
              </div>
            )}
            {"label" in selected.props && (
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={String(selected.props.label ?? "")} onChange={(e) => updateProp(selected.id, "label", e.target.value)} />
              </div>
            )}
            {"src" in selected.props && (
              <div className="space-y-1">
                <Label className="text-xs">Image URL</Label>
                <Input value={String(selected.props.src ?? "")} onChange={(e) => updateProp(selected.id, "src", e.target.value)} />
              </div>
            )}
            <Button variant="destructive" size="sm" className="w-full" onClick={() => removeComponent(selected.id)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete component
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
