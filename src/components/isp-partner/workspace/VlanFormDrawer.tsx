/**
 * Create a VLAN on the venue's router (API_CONTRACT §10).
 *
 * Create is a database row plus a separate Push, exactly as in the customer
 * app: the row is written here, and the panel's Push button is what reaches the
 * MikroTik. Keeping them apart is why renaming or adding a VLAN cannot fail
 * with a device-connection error.
 */
import { useState } from "react";

import { MButton, MDialog, M_INPUT } from "@/components/master/MasterKit";
import { FormError, Spinner } from "@/components/isp-partner/kit";
import { useCreateVenueVlan } from "@/hooks/isp-partner/useVenue";
import { ispErrorMessage } from "@/lib/isp-partner/errors";

export function VlanFormDrawer({
  open,
  onClose,
  routerId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  routerId: string;
  onCreated: () => void;
}) {
  const createM = useCreateVenueVlan(routerId);
  const [vlanId, setVlanId] = useState("");
  const [name, setName] = useState("");
  const [gateway, setGateway] = useState("");
  const [cidr, setCidr] = useState("");
  const [iface, setIface] = useState("");
  const [portMode, setPortMode] = useState<"trunk" | "access">("trunk");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setVlanId("");
    setName("");
    setGateway("");
    setCidr("");
    setIface("");
    setPortMode("trunk");
    setDescription("");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const id = Number(vlanId);
    if (!Number.isInteger(id) || id < 1 || id > 4094) {
      setError("VLAN id must be a whole number between 1 and 4094.");
      return;
    }
    if (!name.trim()) {
      setError("Give the VLAN a name.");
      return;
    }
    try {
      await createM.mutateAsync({
        routerId,
        vlanId: id,
        name: name.trim(),
        gatewayIpAddress: gateway.trim() || null,
        cidr: cidr.trim() || null,
        interface: iface.trim() || null,
        portMode,
        description: description.trim() || null,
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(ispErrorMessage(err));
    }
  };

  return (
    <MDialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New VLAN"
      footer={
        <>
          <MButton
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </MButton>
          <MButton disabled={createM.isPending} onClick={submit}>
            {createM.isPending && <Spinner />} Create
          </MButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">VLAN id</span>
            <input
              className={M_INPUT}
              value={vlanId}
              inputMode="numeric"
              onChange={(e) => setVlanId(e.target.value)}
              placeholder="e.g. 20"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Port mode</span>
            <select
              className={M_INPUT}
              value={portMode}
              onChange={(e) => setPortMode(e.target.value as "trunk" | "access")}
            >
              <option value="trunk">trunk</option>
              <option value="access">access</option>
            </select>
          </label>
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <input
            className={M_INPUT}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Guest network"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Gateway</span>
            <input
              className={M_INPUT}
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              placeholder="10.20.0.1"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">CIDR</span>
            <input
              className={M_INPUT}
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder="10.20.0.0/24"
            />
          </label>
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Interface (optional)</span>
          <input
            className={M_INPUT}
            value={iface}
            onChange={(e) => setIface(e.target.value)}
            placeholder="bridge"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Description (optional)</span>
          <input
            className={M_INPUT}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Creating writes the row only. Use <strong>Push</strong> on the VLAN to apply it to the
          router.
        </p>
        <FormError message={error} />
      </div>
    </MDialog>
  );
}
