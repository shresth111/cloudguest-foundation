import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, Plus, RefreshCw, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import {
  useApiKeys, useCreateApiKey, useCreateWebhook, useDeleteWebhook, useRevokeApiKey,
  useRotateApiKey, useWebhooks,
} from "@/hooks/useSystem";

export const Route = createFileRoute("/_authenticated/api-keys/")({
  component: ApiKeysPage,
});

const SCOPES = ["read", "write", "admin"];
const EVENTS = ["guest.connected", "router.offline", "billing.paid", "security.alert", "portal.published"];

function ApiKeysPage() {
  const keys = useApiKeys();
  const hooks = useWebhooks();
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();
  const rotate = useRotateApiKey();
  const createHook = useCreateWebhook();
  const delHook = useDeleteWebhook();

  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [scopeSel, setScopeSel] = useState<string[]>(["read"]);

  const [openHook, setOpenHook] = useState(false);
  const [url, setUrl] = useState("");
  const [evtSel, setEvtSel] = useState<string[]>([]);

  if (keys.isLoading || hooks.isLoading) return <PageSkeleton />;
  if (keys.isError) return <ErrorState onRetry={() => keys.refetch()} />;

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API management"
        description="Programmatic access, webhooks, and tokens for automation."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />API keys</CardTitle>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Generate key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate API key</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="kn">Name</Label>
                  <Input id="kn" placeholder="Production server" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Scopes</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SCOPES.map((s) => (
                      <Badge
                        key={s}
                        variant={scopeSel.includes(s) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setScopeSel((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                      >{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
                <Button
                  disabled={!name || scopeSel.length === 0}
                  onClick={() => create.mutate({ name, scopes: scopeSel }, {
                    onSuccess: (k) => {
                      toast.success("API key created", { description: k?.key ? "Copy it now — it won't be shown again." : undefined });
                      setName(""); setScopeSel(["read"]); setOpenCreate(false);
                    },
                  })}
                >Generate</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.data?.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">{k.key.slice(0, 12)}…{k.key.slice(-4)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => <Badge key={s} variant="outline" className="capitalize">{s}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(k.lastUsedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => copy(k.key)}><Copy className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => rotate.mutate(k.id, { onSuccess: () => toast.success("Key rotated") })}><RefreshCw className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => revoke.mutate(k.id, { onSuccess: () => toast.success("Key revoked") })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-4 w-4" />Webhooks</CardTitle>
          <Dialog open={openHook} onOpenChange={setOpenHook}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="mr-2 h-4 w-4" />Add webhook</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New webhook</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="url">Endpoint URL</Label>
                  <Input id="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div>
                  <Label>Events</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {EVENTS.map((e) => (
                      <Badge key={e}
                        variant={evtSel.includes(e) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setEvtSel((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e])}
                      >{e}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenHook(false)}>Cancel</Button>
                <Button
                  disabled={!url || evtSel.length === 0}
                  onClick={() => createHook.mutate({ url, events: evtSel }, {
                    onSuccess: () => { toast.success("Webhook added"); setUrl(""); setEvtSel([]); setOpenHook(false); },
                  })}
                >Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hooks.data?.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-xs">{h.url}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {h.events.map((e) => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {h.status === "active" && <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Active</Badge>}
                      {h.status === "paused" && <Badge variant="outline">Paused</Badge>}
                      {h.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => delHook.mutate(h.id, { onSuccess: () => toast.success("Webhook removed") })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
