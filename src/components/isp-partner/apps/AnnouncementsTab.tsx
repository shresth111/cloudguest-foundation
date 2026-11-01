/** Apps -> Announcements: notices to your customers (all, or picked ones),
 * optionally by email. Drafts can be edited, deleted and sent; a sent one is
 * read-only. Managers only write. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Plus, Send, Trash2 } from "lucide-react";
import {
  MButton,
  MDialog,
  MEmptyState,
  MSeg,
  MTable,
  MTd,
  MTh,
  MTr,
  M_INPUT,
} from "@/components/master/MasterKit";
import { ErrorBlock, FormError, Pager, Spinner, TextField } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { StatusTag, appsKeys, useAppsMutation } from "@/components/isp-partner/apps/appsKit";
import { useIspCustomerOptions } from "@/hooks/isp-partner/useIsp";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { formatDateTime } from "@/lib/isp-partner/format";
import { announcementBody, appsCan } from "@/lib/isp-partner/apps";
import { appsService } from "@/services/isp-partner/apps";
import type { Announcement, AnnouncementBody } from "@/services/isp-partner/apps-types";

const STATUS: Record<string, string> = { draft: "Draft", sent: "Sent" };

export function AnnouncementsTab() {
  const { can } = usePartner();
  const c = appsCan(can);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const list = useQuery({
    queryKey: appsKeys.list("announcements", { page }),
    queryFn: () => appsService.announcements(page),
    retry: false,
  });
  const send = useAppsMutation((id: string) => appsService.sendAnnouncement(id));
  const del = useAppsMutation((id: string) => appsService.deleteAnnouncement(id));
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(ispErrorMessage(e));
    }
  };
  return (
    <div className="space-y-3">
      {c.manage && (
        <div className="flex justify-end">
          <MButton onClick={() => setEditing("new")}>
            <Plus /> New announcement
          </MButton>
        </div>
      )}
      {list.error && !list.data ? (
        <ErrorBlock error={list.error} onRetry={() => list.refetch()} what="announcements" />
      ) : list.data && list.data.items.length === 0 ? (
        <MEmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Tell customers about planned work or outages."
        />
      ) : (
        <>
          <MTable
            loading={list.isLoading}
            head={
              <>
                <MTh>Title</MTh>
                <MTh>To</MTh>
                <MTh>Status</MTh>
                <MTh />
              </>
            }
          >
            {(list.data?.items ?? []).map((a) => (
              <MTr key={a.id}>
                <MTd>
                  {a.title}
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{a.body}</p>
                </MTd>
                <MTd className="text-xs">
                  {a.audience === "all" ? "All customers" : `${a.customer_ids.length} customer(s)`}
                  {a.send_email ? " · email" : ""}
                </MTd>
                <MTd>
                  <StatusTag map={STATUS} value={a.status} />
                  {a.sent_at && (
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(a.sent_at)}</p>
                  )}
                </MTd>
                <MTd className="text-right">
                  {c.manage && a.status === "draft" && (
                    <>
                      <MButton variant="ghost" onClick={() => setEditing(a)}>
                        Edit
                      </MButton>
                      <MButton
                        variant="outline"
                        disabled={send.isPending}
                        onClick={() => act(() => send.mutateAsync(a.id), "Sent.")}
                      >
                        <Send /> Send
                      </MButton>
                      <MButton
                        variant="ghost"
                        title="Delete"
                        aria-label={`Delete ${a.title}`}
                        onClick={() => act(() => del.mutateAsync(a.id), "Deleted.")}
                      >
                        <Trash2 />
                      </MButton>
                    </>
                  )}
                </MTd>
              </MTr>
            ))}
          </MTable>
          {list.data && list.data.pages > 1 && (
            <Pager
              page={list.data.page}
              pages={list.data.pages}
              total={list.data.total}
              onPage={setPage}
            />
          )}
        </>
      )}
      {editing && (
        <AnnouncementDialog
          a={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AnnouncementDialog({ a, onClose }: { a: Announcement | null; onClose: () => void }) {
  const customers = useIspCustomerOptions();
  const [d, setD] = useState({
    title: a?.title ?? "",
    body: a?.body ?? "",
    audience: (a?.audience ?? "all") as "all" | "selected",
    customer_ids: a?.customer_ids ?? [],
    send_email: a?.send_email ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const save = useAppsMutation((body: AnnouncementBody) =>
    a ? appsService.patchAnnouncement(a.id, body) : appsService.createAnnouncement(body),
  );
  return (
    <MDialog
      open
      wide
      onClose={onClose}
      title={a ? "Edit announcement" : "New announcement"}
      footer={
        <>
          <MButton variant="outline" onClick={onClose}>
            Cancel
          </MButton>
          <MButton
            disabled={save.isPending}
            onClick={async () => {
              setErr(null);
              const r = announcementBody(d);
              if ("error" in r) return setErr(r.error);
              try {
                await save.mutateAsync(r.body);
                toast.success("Saved as draft. Send it from the list.");
                onClose();
              } catch (e) {
                setErr(ispErrorMessage(e));
              }
            }}
          >
            {save.isPending && <Spinner />} Save draft
          </MButton>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <TextField
          label="Title"
          required
          value={d.title}
          onChange={(v) => setD({ ...d, title: v })}
        />
        <textarea
          className={`${M_INPUT} min-h-[120px]`}
          value={d.body}
          onChange={(e) => setD({ ...d, body: e.target.value })}
          aria-label="Message"
        />
        <MSeg<"all" | "selected">
          value={d.audience}
          onChange={(v) => setD({ ...d, audience: v })}
          options={[
            { value: "all", label: "All customers" },
            { value: "selected", label: "Picked customers" },
          ]}
        />
        {d.audience === "selected" && (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {(customers.data ?? []).map((cu) => (
              <li key={cu.id}>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={d.customer_ids.includes(cu.id)}
                    onChange={(e) =>
                      setD({
                        ...d,
                        customer_ids: e.target.checked
                          ? [...d.customer_ids, cu.id]
                          : d.customer_ids.filter((x) => x !== cu.id),
                      })
                    }
                  />
                  {cu.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={d.send_email}
            onChange={(e) => setD({ ...d, send_email: e.target.checked })}
          />
          Also email the customers' contacts when sent
        </label>
        <FormError message={err} />
      </div>
    </MDialog>
  );
}
