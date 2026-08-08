import { useState } from "react";
import { Link2, Plus, Copy, Ban, CheckCircle2, Trash2, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { copyToClipboard } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  useCreateShortLink,
  useDeleteShortLink,
  useShortLinks,
  useUpdateShortLink,
} from "@/hooks/useShortLinks";
import type { ShortLink } from "@/types/short-link";

const URL_RE = /^https?:\/\/.+/i;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Org's short links -- create, copy, deactivate/revoke, click counts.
 * `locationId` is accepted (every feature view routed through
 * customer.$locationId.$feature.tsx gets it, see that route's own switch)
 * but unused: short links are org-scoped per the backend contract, not
 * per-location. Create/revoke are gated behind the real backend permission
 * keys (`url_shortener.create`/`url_shortener.delete`, via
 * `useAuth().can()` -- same mechanism MasterShell.tsx's own
 * `useOperatorCaps()` uses for the Master console's nav/action gating, the
 * only real backend-permission check this app has; the module-based
 * `usePermissions()`/`can(moduleId, action)` hook is a separate, legacy
 * mock UI-layout system for the older `_authenticated/*` surface and
 * doesn't apply here). */
export function ShortLinksPage({ locationId: _locationId }: { locationId?: string }) {
  const { can } = useAuth();
  const canCreate = can("url_shortener.create");
  const canDelete = can("url_shortener.delete");

  const { data, isLoading } = useShortLinks(1);
  const createLink = useCreateShortLink();
  const updateLink = useUpdateShortLink();
  const deleteLink = useDeleteShortLink();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ targetUrl: "", expiresAt: "" });
  const [revokeTarget, setRevokeTarget] = useState<ShortLink | null>(null);

  const rows = data?.rows ?? [];

  const handleCreate = async () => {
    const url = form.targetUrl.trim();
    if (!URL_RE.test(url)) {
      toast.error("Enter a valid http(s) URL");
      return;
    }
    try {
      await createLink.mutateAsync({
        targetUrl: url,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      toast.success("Short link created");
      setOpen(false);
      setForm({ targetUrl: "", expiresAt: "" });
    } catch {
      toast.error("Could not create the short link — check the connection and try again.");
    }
  };

  const handleCopy = async (link: ShortLink) => {
    const ok = await copyToClipboard(link.shortUrl);
    if (ok) toast.success("Copied to clipboard");
    else toast.error("Couldn't copy automatically — select the link and copy it manually.");
  };

  const handleToggleActive = async (link: ShortLink) => {
    try {
      await updateLink.mutateAsync({ id: link.id, payload: { isActive: !link.isActive } });
      toast.success(link.isActive ? "Link deactivated" : "Link reactivated");
    } catch {
      toast.error("Could not update the link — check the connection and try again.");
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await deleteLink.mutateAsync(revokeTarget.id);
      toast.success(`"${revokeTarget.code}" revoked`);
    } catch {
      toast.error("Could not revoke on the server.");
    } finally {
      setRevokeTarget(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]">
            <Link2 className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Short Links</h2>
            <p className="text-sm text-muted-foreground">
              {rows.length} link{rows.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                New Short Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Short Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label>Destination URL</Label>
                  <Input
                    placeholder="https://example.com/promo"
                    value={form.targetUrl}
                    onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Expires (optional)</Label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createLink.isPending}>
                  {createLink.isPending ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <LoadingSkeleton rows={4} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No short links yet"
              description="Create a short link above to share a memorable, trackable URL for a portal, campaign, or promotion."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-medium">Short URL</TableHead>
                    <TableHead className="text-xs font-medium">Destination</TableHead>
                    <TableHead className="text-xs font-medium">Clicks</TableHead>
                    <TableHead className="text-xs font-medium">Last clicked</TableHead>
                    <TableHead className="text-xs font-medium">Expires</TableHead>
                    <TableHead className="text-xs font-medium">Status</TableHead>
                    <TableHead className="text-right text-xs font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((link) => (
                    <TableRow key={link.id} className="border-b">
                      <TableCell className="font-mono text-xs">{link.shortUrl}</TableCell>
                      <TableCell
                        className="max-w-[220px] truncate text-xs text-muted-foreground"
                        title={link.targetUrl}
                      >
                        {link.targetUrl}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1">
                          <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                          {link.clickCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(link.lastClickedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(link.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={link.isActive ? "default" : "secondary"}>
                          {link.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Copy link"
                          onClick={() => handleCopy(link)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {canDelete && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={link.isActive ? "Deactivate" : "Reactivate"}
                              disabled={updateLink.isPending}
                              onClick={() => handleToggleActive(link)}
                            >
                              {link.isActive ? (
                                <Ban className="h-3.5 w-3.5" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              title="Revoke"
                              onClick={() => setRevokeTarget(link)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke "{revokeTarget?.code}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently revokes the short link. Anyone who visits {revokeTarget?.shortUrl}{" "}
              afterward will no longer reach {revokeTarget?.targetUrl}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmRevoke();
              }}
              disabled={deleteLink.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLink.isPending ? "Revoking…" : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ShortLinksPage;
