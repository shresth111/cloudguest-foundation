import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routerService, type LocalAdminCheck } from "@/services/router.service";
import type { AppError } from "@/services/api";

const CHECK_LABEL: Record<LocalAdminCheck["adminLogin"], string> = {
  blank: "Anyone can log in as admin with no password",
  password_set: "admin has a password",
  unreachable: "Could not test the admin login",
};

/**
 * The router's own local `admin` login, for a person at the venue. Master only.
 *
 * Like `RemoteAccessCard`, the password is fetched only on an explicit click and
 * never kept in a query cache: each reveal is an audited event on the server.
 * "Confirmed" comes from the backend, and only after a real login with this
 * password worked, because RouterOS cannot read a password back.
 */
export function LocalAdminPasswordCard({ routerId }: { routerId: string }) {
  const queryClient = useQueryClient();
  const statusKey = ["routers", "local-admin-status", routerId];
  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: () => routerService.getLocalAdminStatus(routerId),
  });
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reveal" | "apply" | "check" | null>(null);
  const [check, setCheck] = useState<LocalAdminCheck | null>(null);
  const [otherUsers, setOtherUsers] = useState<string[]>([]);

  const status = statusQuery.data?.status ?? null;

  async function run(kind: "reveal" | "apply" | "check", action: () => Promise<void>) {
    setBusy(kind);
    try {
      await action();
    } catch (err) {
      toast.error((err as unknown as AppError).message || "Something went wrong");
      void queryClient.invalidateQueries({ queryKey: statusKey });
    } finally {
      setBusy(null);
    }
  }

  const reveal = () =>
    run("reveal", async () => {
      const secret = await routerService.revealLocalAdminPassword(routerId);
      setPassword(secret.password);
    });

  const apply = () => {
    if (
      !window.confirm(
        "This sets the router's admin password, replacing any password it has now. " +
          "Anyone using the old one will no longer be able to log in. Continue?",
      )
    ) {
      return;
    }
    return run("apply", async () => {
      const result = await routerService.applyLocalAdminPassword(routerId);
      setOtherUsers(result.otherFullAccessUsers);
      toast.success(
        result.deviceChanged
          ? "Password set and confirmed on the router"
          : "The router already has this password",
      );
      await queryClient.invalidateQueries({ queryKey: statusKey });
    });
  };

  const runCheck = () =>
    run("check", async () => {
      const result = await routerService.checkLocalAdminPassword(routerId);
      setCheck(result);
      setOtherUsers(result.otherFullAccessUsers);
    });

  const others = otherUsers.length > 0 && (
    <p className="text-xs text-amber-700 dark:text-amber-400">
      Other full-access accounts on this router: {otherUsers.join(", ")}. This password does not
      close those.
    </p>
  );

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Local login</CardTitle>
        <p className="text-sm text-muted-foreground">
          The router's own admin login, for WinBox at the venue. Only Master operators can see it.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm" data-testid="local-admin-status">
          {statusQuery.isLoading
            ? "Loading..."
            : statusQuery.isError
              ? "Could not read the status."
              : status === "active"
                ? `Confirmed on the router${
                    statusQuery.data?.verifiedAt
                      ? ` on ${new Date(statusQuery.data.verifiedAt).toLocaleString()}`
                      : ""
                  }`
                : status === "pending"
                  ? "Password created, not confirmed on the router yet"
                  : "No password set by the platform yet"}
        </p>

        {password && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
            <code className="truncate text-xs">admin / {password}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(password);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
          </div>
        )}
        {password && status !== "active" && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This password may not work yet, because it has not been confirmed on the router.
          </p>
        )}
        {password && (
          <p className="text-xs text-muted-foreground">This view was recorded in Audit Logs.</p>
        )}

        {check && (
          <p className="text-xs text-muted-foreground" data-testid="local-admin-check">
            {check.adminExists ? CHECK_LABEL[check.adminLogin] : "This router has no admin account"}
            {check.storedPasswordWorks === false && ". The saved password does not work"}
            {check.storedPasswordWorks === true && ". The saved password works"}.
          </p>
        )}
        {others}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={apply}>
            {busy === "apply" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status === "active" ? "Confirm again" : "Set on router"}
          </Button>
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={runCheck}>
            {busy === "check" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Check router
          </Button>
          {status && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => (password ? setPassword(null) : reveal())}
            >
              {busy === "reveal" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : password ? (
                <EyeOff className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {password ? "Hide password" : "Show password"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
