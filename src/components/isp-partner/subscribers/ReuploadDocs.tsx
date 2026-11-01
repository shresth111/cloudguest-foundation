/**
 * DIR-2: photo + signature re-upload from "Edit profile", the same JAZE-3
 * document upload ONBOARD-1 uses (`POST /isp/compliance/subscribers/{id}/
 * documents`, `isp_partner.update`). A new upload is a new document; the
 * previous one stays on file for the audit trail.
 */
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { complianceService } from "@/services/isp-partner/compliance";

const KINDS = [
  { kind: "photo", label: "Photo" },
  { kind: "signature", label: "Signature" },
] as const;

export function ReuploadDocs({ subscriberId }: { subscriberId: string }) {
  const { can } = usePartner();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  if (!can("isp_partner.update")) return null;
  const upload = async (kind: string, file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    try {
      await complianceService.uploadDocument(subscriberId, kind, file);
      qc.invalidateQueries({ queryKey: ["isp", "compliance"] });
      toast.success(`${kind === "photo" ? "Photo" : "Signature"} uploaded.`);
    } catch (e) {
      toast.error(ispErrorMessage(e, "Upload failed."));
    } finally {
      setBusy(null);
    }
  };
  return (
    <fieldset className="space-y-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-foreground">Photo and signature</legend>
      <p className="text-[11px] text-muted-foreground">
        Replace the subscriber&apos;s photo or signature (JPEG/PNG). Earlier files stay on record.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map(({ kind, label }) => (
          <label key={kind} className="block space-y-1.5 text-xs">
            <span className="font-medium text-muted-foreground">
              {label} {busy === kind && <Spinner />}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={busy !== null}
              onChange={(e) => {
                void upload(kind, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
