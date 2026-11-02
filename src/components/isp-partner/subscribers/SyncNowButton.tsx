/**
 * BE-HARDEN "Sync now": coupon sign-ins become subscribers on a 120 s pass;
 * this applies them at once (`POST /isp/subscribers/sync`, the route's own
 * key `isp_subscribers.update`), toasts how many, and refetches the lists.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { MButton } from "@/components/master/MasterKit";
import { Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ispToastError } from "@/lib/isp-partner/error-toast";
import { syncToast } from "@/lib/isp-partner/sync-now";
import { plansService } from "@/services/isp-partner/plans";

export function SyncNowButton() {
  const { can } = usePartner();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => plansService.syncSubscribers(),
    onSuccess: (r) => {
      toast.success(syncToast(r.applied));
      // both lists: the 360 directory and Plans -> Subscribers
      qc.invalidateQueries({ queryKey: ["isp", "sub360"] });
      qc.invalidateQueries({ queryKey: ["isp", "plans", "subscribers"] });
    },
    onError: (e) => ispToastError(e, "The sync failed."),
  });
  if (!can("isp_subscribers.update")) return null;
  return (
    <MButton
      variant="outline"
      disabled={m.isPending}
      title="Add coupon sign-ins now instead of waiting for the next automatic sync"
      onClick={() => m.mutate()}
    >
      {m.isPending ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Sync now
    </MButton>
  );
}
