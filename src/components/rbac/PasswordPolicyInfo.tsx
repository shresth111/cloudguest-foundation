import { CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RULES = [
  "Between 12 and 128 characters",
  "At least one uppercase letter",
  "At least one lowercase letter",
  "At least one digit",
  "At least one special character (!@#$%^&*-_=+)",
  "Rejects common/breached passwords",
  "Cannot reuse any of the last 5 passwords",
];

export function PasswordPolicyInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Password policy</CardTitle>
        <p className="text-xs text-muted-foreground">
          This is a fixed platform-wide policy (Argon2id hashing) enforced by the backend — there is
          no admin setting to change it. Values shown here are mirrored from the backend's own
          source, not fetched live.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {RULES.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {r}
            </li>
          ))}
        </ul>
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4" /> Account lockout
          </div>
          <p className="text-sm text-muted-foreground">
            5 consecutive failed login attempts locks the account for 30 minutes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
