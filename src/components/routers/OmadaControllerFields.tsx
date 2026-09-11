import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AUTH_MODE_CHOICES, TLS_MODE_CHOICES } from "@/lib/omada-controller-choices";
import type { OmadaControllerDraft } from "@/lib/router-schemas";

/**
 * The TP-Link Omada controller form, in one place.
 *
 * Two screens register a controller together with its fleet row: Routers ->
 * Add router (`RouterWizard`, for a venue that already exists) and Smart
 * Location Provisioning's first-device step (`PlatformLocationWizard`, for a
 * brand-new customer whose venue has no MikroTik). Both render these
 * components and validate with `omadaControllerIssues`, so an operator sees
 * the same fields, the same advice and the same rules on either path.
 *
 * Controlled rather than bound to react-hook-form: the device wizard uses
 * react-hook-form and the provisioning wizard uses plain state, and a
 * `value`/`onChange`/`errors` component serves both without either one
 * changing how it holds its form.
 */

/** A row of selectable cards -- the choice control both wizards use for
 * device type, authentication and certificate check. */
export function ChoiceCards<T extends string>({
  value,
  onChange,
  choices,
  columns = 1,
}: {
  value: T;
  onChange: (next: T) => void;
  choices: ReadonlyArray<{ id: T; label: string; description: string }>;
  columns?: 1 | 2;
}) {
  return (
    <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          onClick={() => onChange(choice.id)}
          aria-pressed={value === choice.id}
          className={cn(
            "rounded-lg border px-3 py-2 text-left transition-colors",
            value === choice.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
          )}
        >
          <div className="text-sm font-medium">{choice.label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{choice.description}</div>
        </button>
      ))}
    </div>
  );
}

export type OmadaFieldErrors = Partial<Record<keyof OmadaControllerDraft, string | undefined>>;

/**
 * Address, authentication, credentials, Omada ID and certificate trust for
 * one controller.
 *
 * Skipping credentials is not offered: an integration without them cannot
 * authorise a single guest, so a row created that way would be a
 * registration that does nothing. `omadaControllerIssues` requires them.
 */
export function OmadaConnectionFields({
  value,
  onChange,
  errors = {},
  idPrefix = "omada",
}: {
  value: OmadaControllerDraft;
  onChange: (next: OmadaControllerDraft) => void;
  errors?: OmadaFieldErrors;
  idPrefix?: string;
}) {
  const set = <K extends keyof OmadaControllerDraft>(key: K, next: OmadaControllerDraft[K]) =>
    onChange({ ...value, [key]: next });

  const text = (
    key: keyof OmadaControllerDraft,
    label: string,
    options: { placeholder?: string; type?: string; className?: string } = {},
  ) => (
    <div className={options.className}>
      <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
      <Input
        id={`${idPrefix}-${key}`}
        type={options.type ?? "text"}
        placeholder={options.placeholder}
        value={(value[key] as string | undefined) ?? ""}
        onChange={(e) => set(key, e.target.value as never)}
        autoComplete={options.type === "password" ? "new-password" : "off"}
      />
      {errors[key] && <p className="mt-1 text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {text("baseUrl", "Controller address", {
        placeholder: "https://controller.example.com:8043",
      })}
      <div>
        <Label>Authentication</Label>
        <div className="mt-1">
          <ChoiceCards
            value={value.authMode}
            onChange={(next) => set("authMode", next)}
            choices={AUTH_MODE_CHOICES}
          />
        </div>
      </div>
      {value.authMode === "openapi" && (
        <>
          {text("clientId", "Client ID")}
          {text("clientSecret", "Client secret", { type: "password" })}
        </>
      )}
      {/* In both modes -- the controller lets a guest online only through
          its hotspot operator login. See `omadaControllerIssues`. */}
      {text("username", "Hotspot operator name")}
      {text("password", "Hotspot operator password", { type: "password" })}
      {text("controllerId", "Omada ID (TP-Link cloud controllers only)", {
        placeholder: "Leave blank for a controller reached directly",
      })}
      <div>
        <Label>Certificate check</Label>
        <div className="mt-1">
          <ChoiceCards
            value={value.tlsMode}
            onChange={(next) => set("tlsMode", next)}
            choices={TLS_MODE_CHOICES}
          />
        </div>
      </div>
      {value.tlsMode === "pinned" &&
        text("tlsPinnedSha256", "Certificate fingerprint (SHA-256)", {
          placeholder: "AB:CD:EF:… — 64 hexadecimal characters",
        })}
      <p className="sm:col-span-2 text-xs text-muted-foreground">
        Sent to the controller from this platform's servers, never from your browser, and stored
        encrypted. No endpoint returns them again.
      </p>
    </div>
  );
}
