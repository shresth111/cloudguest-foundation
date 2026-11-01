/** What prints in the CAF header and signatory box (CAF-2). Legal name,
 * licence no. and GSTIN come from Compliance -> Settings (JAZE-3); the
 * signatory and the stamp image are kept here. */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Stamp, Trash2 } from "lucide-react";
import { MButton, MTag } from "@/components/master/MasterKit";
import { Card, FormError, Spinner, TextField } from "@/components/isp-partner/kit";
import { ispErrorMessage } from "@/lib/isp-partner/errors";
import { cafService, type CafProfile } from "@/services/isp-partner/caf";

export function CafProfileCard({
  profile,
  canManage,
}: {
  profile: CafProfile;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(profile.signatory_name ?? "");
  const [designation, setDesignation] = useState(profile.signatory_designation ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      qc.invalidateQueries({ queryKey: ["isp", "caf", "options"] });
    } catch (e) {
      setErr(ispErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="CAF header and signatory">
      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Legal name</dt>
        <dd>{profile.legal_name ?? "–"}</dd>
        <dt className="text-muted-foreground">Licence no.</dt>
        <dd>
          {profile.licence_number ?? "Not set"}
          {profile.licence_category ? ` (${profile.licence_category})` : ""}
        </dd>
        <dt className="text-muted-foreground">GSTIN</dt>
        <dd>{profile.gstin ?? "–"}</dd>
      </dl>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Change these in Compliance → Settings.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Authorised signatory"
          value={name}
          onChange={setName}
          disabled={!canManage}
        />
        <TextField
          label="Designation"
          value={designation}
          onChange={setDesignation}
          disabled={!canManage}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <MTag label={profile.stamp_set ? "Stamp on file" : "No stamp"} />
        {canManage && (
          <>
            <MButton
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    cafService.saveProfile({
                      signatory_name: name.trim() || null,
                      signatory_designation: designation.trim() || null,
                    }),
                  "Saved.",
                )
              }
            >
              {busy && <Spinner />} Save signatory
            </MButton>
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 8 * 1024 * 1024) return setErr("The stamp image must be under 8 MB.");
                run(() => cafService.uploadStamp(f), "Stamp saved.");
              }}
            />
            <MButton variant="outline" disabled={busy} onClick={() => file.current?.click()}>
              <Stamp /> {profile.stamp_set ? "Replace stamp" : "Upload stamp"}
            </MButton>
            {profile.stamp_set && (
              <MButton
                variant="ghost"
                disabled={busy}
                onClick={() => run(() => cafService.removeStamp(), "Stamp removed.")}
              >
                <Trash2 /> Remove
              </MButton>
            )}
          </>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        The stamp is resized and compressed before it is stored and printed.
      </p>
      <FormError message={err} />
    </Card>
  );
}
